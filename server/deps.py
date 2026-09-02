# ===== 依赖注入：获取当前用户、数据库连接等 =====
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import json
import pymysql
from pymysql.cursors import DictCursor
from security import decode_token
from db import get_conn

# Bearer token 认证方案
bearer_scheme = HTTPBearer(auto_error=False)

# 解析 token 并返回当前用户 ID
def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> int:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="请先登录",
        )
    if not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="缺少登录凭证，请先登录",
        )
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="登录凭证无效或已过期，请重新登录",
        )

    # 验证 token 中的用户 ID 是否真实存在于数据库（防止伪造/已删除用户）
    conn = get_conn()
    try:
        row = conn.execute(
            "SELECT id, is_active FROM users WHERE id=%s", (user_id,)
        ).fetchone()
    finally:
        conn.close()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户不存在或已被注销，请重新注册后登录",
        )
    if not row["is_active"]:
        # 软注销用户：拒绝所有受保护操作
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="账号已注销，无法执行此操作",
        )
    return user_id

# 获取用户的 LLM 配置（共享给 menus 和 today 路由）
def get_user_llm_config(user_id: int, db: pymysql.connections.Connection) -> dict:
    row = db.execute(
        "SELECT llm_config FROM user_settings WHERE user_id=%s", (user_id,)
    ).fetchone()
    if not row or not row["llm_config"]:
        raise HTTPException(status_code=400, detail="请先在模型设置中配置 LLM")
    try:
        return json.loads(row["llm_config"])
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="LLM 配置格式错误，请重新设置")

# 获取数据库连接（每次请求都会创建新连接）
def get_db() -> pymysql.connections.Connection:
    conn = get_conn()
    try:
        yield conn
    finally:
        conn.close()