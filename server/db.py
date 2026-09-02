# ===== 数据库初始化：MySQL 建表 =====
import pymysql
from pymysql.cursors import DictCursor
from config import DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME


class DbWrapper:
    """pymysql Connection 的包装器，提供 .execute() 快捷方法（返回 Cursor，支持链式 .fetchone()/.fetchall()）"""
    def __init__(self, conn: pymysql.connections.Connection):
        self._conn = conn

    def execute(self, sql: str, params=None):
        cursor = self._conn.cursor()
        cursor.execute(sql, params)
        return cursor

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def cursor(self):
        return self._conn.cursor()


# 获取数据库连接（默认 DictCursor：查询结果按列名访问 row["col"]）
def get_conn() -> DbWrapper:
    conn = pymysql.connect(
        host=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )
    return DbWrapper(conn)


# 初始化建表
def init_db():
    conn = get_conn()
    cursor = conn.cursor()

    # 用户表（username/email 不做唯一约束：注销用户为软删记录，其用户名/邮箱允许被新用户复用）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            email VARCHAR(255) DEFAULT NULL,
            email_verified TINYINT(1) DEFAULT 0,
            is_active TINYINT(1) DEFAULT 1,
            deleted_at DATETIME DEFAULT NULL,
            last_login_at DATETIME DEFAULT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            KEY idx_username (username),
            KEY idx_email (email)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # 验证码表（找回密码 / 邮箱绑定验证）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS verification_codes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            email VARCHAR(255) NOT NULL,
            code VARCHAR(6) NOT NULL,
            purpose VARCHAR(32) NOT NULL,
            expires_at DATETIME NOT NULL,
            used TINYINT(1) DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # 用户设置表（LLM 配置 + 已应用菜单）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_settings (
            user_id INT PRIMARY KEY,
            theme VARCHAR(32) DEFAULT 'jade',
            llm_config TEXT,
            applied_menu TEXT,
            CONSTRAINT fk_us_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # 菜单表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS menus (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(255) DEFAULT '',
            config TEXT NOT NULL,
            data TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_m_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # 食材清单表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ingredient_lists (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            menu_id INT,
            items TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_il_user FOREIGN KEY (user_id) REFERENCES users(id),
            CONSTRAINT fk_il_menu FOREIGN KEY (menu_id) REFERENCES menus(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # 今日计划表
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS today_plans (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            date VARCHAR(20) NOT NULL,
            data TEXT NOT NULL,
            note TEXT,
            UNIQUE KEY uk_today_user_date (user_id, date),
            CONSTRAINT fk_tp_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    # 食谱表（user_id 可为 NULL：公共食谱不绑定用户）
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS recipes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT,
            name VARCHAR(255),
            category VARCHAR(64),
            ingredients TEXT,
            steps TEXT,
            tips TEXT,
            cook_time VARCHAR(64),
            difficulty VARCHAR(32),
            favorite TINYINT(1) DEFAULT 0,
            is_public TINYINT(1) DEFAULT 0,
            source_recipe_id INT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_r_user FOREIGN KEY (user_id) REFERENCES users(id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    conn.commit()

    # 创建索引（加速常用查询）
    _create_indexes(cursor, conn)

    conn.close()
    print(f"[DB] MySQL 数据库初始化完成: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")


# 创建索引（幂等）
def _create_indexes(cursor, conn):
    indexes = [
        "CREATE INDEX idx_menus_user_id ON menus(user_id)",
        "CREATE INDEX idx_menus_user_created ON menus(user_id, created_at DESC)",
        "CREATE INDEX idx_recipes_user_id ON recipes(user_id)",
        "CREATE INDEX idx_recipes_public ON recipes(is_public)",
        "CREATE INDEX idx_recipes_user_source ON recipes(user_id, source_recipe_id)",
        "CREATE INDEX idx_today_plans_user_date ON today_plans(user_id, date)",
        "CREATE INDEX idx_ingredient_lists_user_menu ON ingredient_lists(user_id, menu_id)",
        "CREATE INDEX idx_verification_codes_email ON verification_codes(email, purpose)",
    ]
    created = 0
    for sql in indexes:
        try:
            cursor.execute(sql)
            created += 1
        except Exception:
            pass  # 索引已存在则跳过
    conn.commit()
    print(f"[DB] 已创建 {created} 个索引")

    # 清理过期验证码（启动时执行一次）
    cursor.execute("DELETE FROM verification_codes WHERE expires_at < NOW()")
    conn.commit()