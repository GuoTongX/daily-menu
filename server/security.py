# ===== 安全工具：密码哈希 + JWT =====
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from config import SECRET_KEY, ALGORITHM, TOKEN_EXPIRE_DAYS

# 使用 bcrypt 直接哈希密码（避免 passlib 在 Python 3.14 下的兼容问题）
def hash_password(password: str) -> str:
    """生成 bcrypt 密码哈希"""
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

# 校验密码
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """验证密码是否匹配"""
    try:
        return bcrypt.checkpw(
            plain_password.encode('utf-8'),
            hashed_password.encode('utf-8')
        )
    except Exception:
        return False

# 生成 JWT token
def create_token(user_id: int, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "username": username, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# 解析 JWT token，返回 payload 或抛异常
def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])