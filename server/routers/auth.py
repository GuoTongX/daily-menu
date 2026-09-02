# ===== 认证路由：注册 / 登录 / 当前用户 / 找回密码 =====
from fastapi import APIRouter, Depends, HTTPException, Request
from pymysql.err import IntegrityError
import os
import random
import time
import threading
from datetime import datetime, timedelta, timezone
import pymysql
from schemas import (
    RegisterSendCodeRequest, RegisterConfirmRequest, LoginRequest, AuthResponse, UserResponse,
    ForgotPasswordSendCodeRequest, ForgotPasswordResetRequest,
)
from security import hash_password, verify_password, create_token
from deps import get_current_user_id, get_db
from services.email_service import send_verification_code
from utils import password_error

router = APIRouter(prefix="/api/auth", tags=["auth"])

# 注册暂存信息（内存）：email -> {username, password_hash}
_pending_registrations: dict[str, dict] = {}
_pending_lock = threading.Lock()

# 登录速率限制：基于 IP + 用户名的简单内存计数器
_login_attempts: dict[str, list[float]] = {}
_login_lock = threading.Lock()
_MAX_ATTEMPTS = 5          # 每分钟最多 5 次
_ATTEMPT_WINDOW = 60       # 窗口 60 秒
_ATTEMPT_COOLDOWN = 300    # 超过阈值后冷却 5 分钟


def _check_rate_limit(key: str) -> bool:
    """检查速率限制，返回 True 表示允许通过"""
    now = time.time()
    with _login_lock:
        attempts = _login_attempts.get(key, [])
        # 清理过期记录
        attempts = [t for t in attempts if now - t < _ATTEMPT_WINDOW]
        _login_attempts[key] = attempts
        if len(attempts) >= _MAX_ATTEMPTS:
            return False
        return True


def _record_attempt(key: str):
    """记录一次尝试"""
    now = time.time()
    with _login_lock:
        _login_attempts.setdefault(key, []).append(now)
        # 定期清理过期记录（内存泄漏防护）
        if len(_login_attempts) > 1000:
            stale = [k for k, v in _login_attempts.items() if all(now - t > 600 for t in v)]
            for k in stale:
                del _login_attempts[k]


# 注册：发送验证码（第一步）
@router.post("/register/send-code")
def register_send_code(req: RegisterSendCodeRequest, request: Request, db: pymysql.connections.Connection = Depends(get_db)):
    username = req.username.strip()
    email = req.email.strip().lower()
    if not email or "@" not in email or "." not in email.split("@")[-1]:
        raise HTTPException(status_code=400, detail="请输入有效的邮箱地址")

    # 密码复杂度校验（8-12 位，仅字母+数字，且同时包含字母和数字）
    pwd_err = password_error(req.password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)

    # 用户名唯一（仅对有效用户生效；注销用户的用户名可被复用）
    existing = db.execute(
        "SELECT id FROM users WHERE LOWER(username)=LOWER(%s) AND is_active=1", (username,)
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="用户名已被占用")

    # 邮箱唯一（仅对有效用户生效；注销用户的邮箱可被复用）
    existing_email = db.execute(
        "SELECT id FROM users WHERE email=%s AND is_active=1", (email,)
    ).fetchone()
    if existing_email:
        raise HTTPException(status_code=400, detail="该邮箱已被绑定")

    # 速率限制
    client_ip = request.client.host if request.client else "unknown"
    if not _check_code_send_limit(f"ip:{client_ip}"):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    # 暂存注册信息（内存）
    password_hash = hash_password(req.password)
    with _pending_lock:
        _pending_registrations[email] = {"username": username, "password_hash": password_hash}

    # 发验证码
    code = _generate_code()
    _store_code(db, email, code, "register")
    result = send_verification_code(email, code, "register")
    return {"message": "验证码已发送到邮箱", **result}


# 注册：确认验证码（第二步）
@router.post("/register/confirm", response_model=AuthResponse)
def register_confirm(req: RegisterConfirmRequest, db: pymysql.connections.Connection = Depends(get_db)):
    email = req.email.strip().lower()

    if not _validate_code(db, email, req.code, "register"):
        raise HTTPException(status_code=400, detail="验证码无效或已过期，请重新获取")

    # 获取暂存信息
    with _pending_lock:
        pending = _pending_registrations.pop(email, None)
    if not pending:
        raise HTTPException(status_code=400, detail="注册信息已过期，请重新填写")

    username = pending["username"]
    password_hash = pending["password_hash"]

    # 再次检查唯一性（防并发竞争；注销用户的用户名/邮箱可复用）
    if db.execute("SELECT id FROM users WHERE LOWER(username)=LOWER(%s) AND is_active=1", (username,)).fetchone():
        raise HTTPException(status_code=400, detail="用户名已被占用")
    if db.execute("SELECT id FROM users WHERE email=%s AND is_active=1", (email,)).fetchone():
        raise HTTPException(status_code=400, detail="该邮箱已被绑定")

    try:
        cursor = db.execute(
            "INSERT INTO users (username, password_hash, email, email_verified) VALUES (%s, %s, %s, 1)",
            (username, password_hash, email),
        )
        db.commit()
        user_id = cursor.lastrowid
        db.execute("INSERT INTO user_settings (user_id) VALUES (%s)", (user_id,))
        db.commit()
    except IntegrityError:
        raise HTTPException(status_code=400, detail="注册失败，请重试")

    token = create_token(user_id, username)
    return AuthResponse(
        token=token,
        user=UserResponse(id=user_id, username=username, email=email, email_verified=True, is_active=True),
    )


# 登录（支持用户名或邮箱）
@router.post("/login", response_model=AuthResponse)
def login(req: LoginRequest, request: Request, db: pymysql.connections.Connection = Depends(get_db)):
    credential = req.username.strip()
    # 速率限制：基于 IP + 凭据
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{credential.lower()}"
    if not _check_rate_limit(rate_key):
        raise HTTPException(status_code=429, detail="登录尝试过于频繁，请稍后再试")

    # 支持用户名或邮箱登录（不区分大小写）
    row = db.execute(
        "SELECT * FROM users WHERE (LOWER(username)=LOWER(%s) OR LOWER(email)=LOWER(%s)) AND is_active=1",
        (credential, credential),
    ).fetchone()
    if not row:
        _record_attempt(rate_key)
        raise HTTPException(status_code=401, detail="该用户名或邮箱不存在")

    if not verify_password(req.password, row["password_hash"]):
        _record_attempt(rate_key)
        raise HTTPException(status_code=401, detail="密码错误")

    # 更新最后登录时间
    db.execute("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=%s", (row["id"],))
    db.commit()

    token = create_token(row["id"], row["username"])
    return AuthResponse(
        token=token,
        user=UserResponse(
            id=row["id"], username=row["username"], email=row["email"],
            email_verified=bool(row["email_verified"]), is_active=True,
        ),
    )


# 当前用户
@router.get("/me", response_model=UserResponse)
def me(user_id: int = Depends(get_current_user_id), db: pymysql.connections.Connection = Depends(get_db)):
    row = db.execute(
        "SELECT id, username, email, email_verified, is_active, created_at FROM users WHERE id=%s", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="用户不存在")
    return UserResponse(
        id=row["id"], username=row["username"],
        email=row["email"], email_verified=bool(row["email_verified"]),
        is_active=bool(row["is_active"]),
        created_at=row["created_at"],
    )


# ===== 找回密码 =====

# 生成 6 位数字验证码
def _generate_code() -> str:
    return f"{random.randint(0, 999999):06d}"


# 验证码发送速率限制（每邮箱每分钟 1 次） + IP 级限制
_code_send_limits: dict[str, float] = {}
_code_send_lock = threading.Lock()
_CODE_SEND_WINDOW = 60  # 秒


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
        # 定期清理（防内存泄漏）
        if len(_code_send_limits) > 1000:
            stale = [k for k, t in _code_send_limits.items() if now - t > 600]
            for k in stale:
                del _code_send_limits[k]
    return True


def _store_code(db, email: str, code: str, purpose: str):
    """使旧验证码失效并写入新验证码（有效期 10 分钟）"""
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
    """校验验证码（有效 + 未使用 + 未过期），校验成功即置为已使用"""
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


# 找回密码：发送验证码（无需登录）
@router.post("/forgot-password/send-code")
def forgot_password_send_code(
    req: ForgotPasswordSendCodeRequest,
    request: Request,
    db: pymysql.connections.Connection = Depends(get_db),
):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="请输入有效的邮箱地址")

    # 速率限制：每邮箱 + 每 IP 每分钟 1 次
    client_ip = request.client.host if request.client else "unknown"
    if not _check_code_send_limit(f"email:{email}") or not _check_code_send_limit(f"ip:{client_ip}"):
        raise HTTPException(status_code=429, detail="操作过于频繁，请稍后再试")

    # 查询用户：仅有效账号可找回密码（邮箱不存在或已注销均提示不存在）
    user = db.execute(
        "SELECT id, is_active FROM users WHERE email=%s AND is_active=1", (email,)
    ).fetchone()
    if not user:
        raise HTTPException(status_code=400, detail="该邮箱不存在")

    code = _generate_code()
    _store_code(db, email, code, "password_reset")
    result = send_verification_code(email, code, "password_reset")

    return {"message": "验证码已发送到你的邮箱", **result}


# 找回密码：重置密码（无需登录）
@router.post("/forgot-password/reset")
def forgot_password_reset(
    req: ForgotPasswordResetRequest,
    db: pymysql.connections.Connection = Depends(get_db),
):
    email = req.email.strip().lower()
    # 密码复杂度校验
    pwd_err = password_error(req.new_password)
    if pwd_err:
        raise HTTPException(status_code=400, detail=pwd_err)

    # 校验验证码
    if not _validate_code(db, email, req.code, "password_reset"):
        raise HTTPException(status_code=400, detail="验证码无效或已过期，请重新获取")

    user = db.execute(
        "SELECT id, password_hash FROM users WHERE email=%s AND is_active=1", (email,)
    ).fetchone()
    if not user:
        raise HTTPException(status_code=400, detail="该邮箱不存在")

    # 新密码不能与旧密码完全一致
    if verify_password(req.new_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="新密码不能与旧密码相同，请重新设置")

    new_hash = hash_password(req.new_password)
    db.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, user["id"]))
    # 使该邮箱所有剩余未用验证码失效
    db.execute(
        "UPDATE verification_codes SET used=1 WHERE email=%s AND used=0",
        (email,),
    )
    db.commit()
    return {"message": "密码已重置，请使用新密码登录"}