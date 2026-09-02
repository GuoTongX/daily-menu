# ===== 账户管理路由：邮箱绑定 / 修改密码 / 注销账号 =====
import os
import time
import random
import threading
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
import pymysql
from schemas import (
    BindEmailSendCodeRequest, BindEmailConfirmRequest, UserResponse,
    ChangePasswordRequest, DeactivateSendCodeRequest, DeactivateConfirmRequest,
)
from security import hash_password, verify_password
from deps import get_current_user_id, get_db
from services.email_service import send_verification_code
from utils import password_error

router = APIRouter(prefix="/api/account", tags=["account"])

# 验证码发送速率限制（每邮箱每分钟 1 次）
_code_send_limits: dict[str, float] = {}
_code_send_lock = threading.Lock()
_CODE_SEND_WINDOW = 60


def _check_code_send_limit(key: str) -> bool:
    # 测试环境下不限制（tests 通过环境变量标记）
    if os.environ.get("DM_TEST_MODE") == "1":
        return True
    now = time.time()
    with _code_send_lock:
        last = _code_send_limits.get(key)
        if last and now - last < _CODE_SEND_WINDOW:
            return False
        _code_send_limits[key] = now
        if len(_code_send_limits) > 1000:
            stale = [k for k, t in _code_send_limits.items() if now - t > 600]
            for k in stale:
                del _code_send_limits[k]
    return True


def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


def _store_code(db, email: str, code: str, purpose: str):
    db.execute(
        "UPDATE verification_codes SET used=1 WHERE email=%s AND purpose=%s AND used=0",
        (email, purpose),
    )
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    db.execute(
        "INSERT INTO verification_codes (email, code, purpose, expires_at) VALUES (%s, %s, %s, %s)",
        (email, code, purpose, expires_at.strftime("%Y-%m-%d %H:%M:%S")),
    )
    db.commit()


def _validate_code(db, email: str, code: str, purpose: str) -> bool:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    row = db.execute(
        "SELECT id FROM verification_codes WHERE email=%s AND code=%s AND purpose=%s AND used=0 AND expires_at > %s",
        (email, code, purpose, now),
    ).fetchone()
    if not row:
        return False
    db.execute("UPDATE verification_codes SET used=1 WHERE id=%s", (row["id"],))
    db.commit()
    return True


# ===== 邮箱绑定 =====

# ===== 邮箱绑定 / 更换（不支持解绑，只能更换） =====

# 发送验证码（需验证当前密码）
@router.post("/bind-email/send-code")
def bind_email_send_code(
    req: BindEmailSendCodeRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="请输入有效的邮箱地址")

    # 验证当前密码（确认是账户本人操作）
    row = db.execute(
        "SELECT password_hash FROM users WHERE id=%s", (user_id,)
    ).fetchone()
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="当前密码错误")

    # 速率限制
    if not _check_code_send_limit(f"bind:{email}"):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    # 检查邮箱是否已被其他有效用户绑定（注销用户邮箱可被复用；自己可换绑到新邮箱）
    existing = db.execute(
        "SELECT id FROM users WHERE email=%s AND id!=%s AND is_active=1", (email, user_id)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被其他账号绑定")

    code = _generate_code()
    _store_code(db, email, code, "email_verify")
    result = send_verification_code(email, code, "email_verify")
    return {"message": "验证码已发送到邮箱", **result}


# 确认绑定/更换
@router.post("/bind-email/confirm", response_model=UserResponse)
def bind_email_confirm(
    req: BindEmailConfirmRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    email = req.email.strip().lower()
    if not _validate_code(db, email, req.code, "email_verify"):
        raise HTTPException(status_code=400, detail="验证码无效或已过期，请重新获取")

    # 再次检查邮箱是否被他人占用（注销用户邮箱可复用；防并发竞争）
    existing = db.execute(
        "SELECT id FROM users WHERE email=%s AND id!=%s AND is_active=1", (email, user_id)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="该邮箱已被其他账号绑定")

    db.execute(
        "UPDATE users SET email=%s, email_verified=1 WHERE id=%s",
        (email, user_id),
    )
    db.commit()

    row = db.execute(
        "SELECT id, username, email, email_verified, is_active, created_at FROM users WHERE id=%s",
        (user_id,),
    ).fetchone()
    return UserResponse(
        id=row["id"], username=row["username"],
        email=row["email"], email_verified=bool(row["email_verified"]),
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


# ===== 修改密码 =====
@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT password_hash FROM users WHERE id=%s", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    if not verify_password(req.current_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="当前密码错误")

    # 密码复杂度校验（8-12 位，仅字母+数字，且同时包含字母和数字）
    pwd_err = password_error(req.new_password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)

    # 新密码不能与当前密码完全一致
    if verify_password(req.new_password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="新密码不能与当前密码相同")

    new_hash = hash_password(req.new_password)
    db.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, user_id))
    db.commit()
    return {"message": "密码已修改"}


# ===== 注销账号（软注销，两阶段验证码） =====
@router.post("/deactivate/send-code")
def deactivate_send_code(
    req: DeactivateSendCodeRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT email, password_hash FROM users WHERE id=%s", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    # 验证当前密码
    if not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=400, detail="密码错误，无法注销")

    email = row["email"]
    if not email:
        raise HTTPException(status_code=400, detail="账户未绑定邮箱，无法通过验证码注销")

    # 速率限制
    if not _check_code_send_limit(f"deactivate:{email}"):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    code = _generate_code()
    _store_code(db, email, code, "deactivate")
    result = send_verification_code(email, code, "deactivate")
    return {"message": "验证码已发送到你的邮箱", **result}


# 注销账号：确认验证码（第二步）
@router.post("/deactivate/confirm")
def deactivate_confirm(
    req: DeactivateConfirmRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT email, is_active FROM users WHERE id=%s", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")

    email = row["email"]
    if not email:
        raise HTTPException(status_code=400, detail="账户未绑定邮箱")

    if not _validate_code(db, email, req.code, "deactivate"):
        raise HTTPException(status_code=400, detail="验证码无效或已过期，请重新获取")

    db.execute(
        "UPDATE users SET is_active=0, deleted_at=CURRENT_TIMESTAMP WHERE id=%s",
        (user_id,),
    )
    db.commit()
    return {"message": "账号已注销"}