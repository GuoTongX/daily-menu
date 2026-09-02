# ===== 后端配置 =====
import os
import secrets

# JWT 密钥（生产环境通过环境变量注入，开发环境自动生成并持久化）
SECRET_KEY = os.environ.get("DM_SECRET_KEY", "")
ALGORITHM = "HS256"
TOKEN_EXPIRE_DAYS = int(os.environ.get("DM_TOKEN_EXPIRE_DAYS", "7"))

# 数据库配置（MySQL / MariaDB，通过环境变量覆盖）
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))

DB_HOST = os.environ.get("DM_DB_HOST", "127.0.0.1")
DB_PORT = int(os.environ.get("DM_DB_PORT", "3306"))
DB_USER = os.environ.get("DM_DB_USER", "root")
DB_PASSWORD = os.environ.get("DM_DB_PASSWORD", "")
DB_NAME = os.environ.get("DM_DB_NAME", "daily_menu")
# 连接池大小（pymysql 连接复用）
DB_POOL_SIZE = int(os.environ.get("DM_DB_POOL_SIZE", "10"))

# 确保 SECRET_KEY 已设置（未设置时自动生成并写入 .env，避免硬编码默认值）
if not SECRET_KEY:
    _secret_file = os.path.join(SERVER_DIR, ".secret_key")
    if os.path.exists(_secret_file):
        SECRET_KEY = open(_secret_file).read().strip()
    else:
        SECRET_KEY = secrets.token_urlsafe(32)
        with open(_secret_file, "w") as f:
            f.write(SECRET_KEY)
        print(f"[config] 已生成随机 SECRET_KEY 并保存到 {_secret_file}")

# CORS 允许的域名（从环境变量读取，逗号分隔）
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",")

# SMTP 配置（用于找回密码、邮箱验证等邮件发送）
# DM_SMTP_SSL: auto（默认，端口 465/994 自动用 SSL）/ true / false
SMTP_HOST = os.environ.get("DM_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("DM_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("DM_SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("DM_SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("DM_SMTP_FROM", SMTP_USER)
SMTP_TLS = os.environ.get("DM_SMTP_TLS", "True").lower() in ("true", "1", "yes")
SMTP_SSL = os.environ.get("DM_SMTP_SSL", "auto").lower()
