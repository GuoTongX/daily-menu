# ===== 公共食谱种子脚本 =====
# 向数据库插入预置的公共食谱（is_public=1），仅用于初始化。
# 运行前请确保数据库中无旧公共食谱数据。
#
# 用法：
#   cd server
#   python seed_public_recipes.py
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from db import get_conn
from data.public_recipes import PUBLIC_RECIPES


def seed():
    conn = get_conn()
    try:
        cursor = conn.cursor()
        inserted = 0
        for r in PUBLIC_RECIPES:
            cursor.execute(
                "INSERT INTO recipes (user_id, name, category, ingredients, steps, tips, cook_time, difficulty, is_public) "
                "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 1)",
                (
                    None,
                    r["name"],
                    r["category"],
                    json.dumps(r["ingredients"], ensure_ascii=False),
                    json.dumps(r["steps"], ensure_ascii=False),
                    r["tips"],
                    r["cook_time"],
                    r["difficulty"],
                ),
            )
            inserted += 1

        conn.commit()
        print(f"[seed] 已插入 {inserted} 条公共食谱")
        return inserted
    finally:
        conn.close()


if __name__ == "__main__":
    seed()
