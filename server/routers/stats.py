# ===== 统计路由：总览页真实数据聚合 =====
from fastapi import APIRouter, Depends
import pymysql
from deps import get_current_user_id, get_db

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats(
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 合并 4 次 COUNT 查询为 1 次
    row = db.execute(
        """SELECT
            (SELECT COUNT(*) FROM menus WHERE user_id=%s) AS menus,
            (SELECT COUNT(*) FROM today_plans WHERE user_id=%s) AS today_count,
            (SELECT COUNT(*) FROM ingredient_lists WHERE user_id=%s) AS ingredients,
            (SELECT COUNT(*) FROM recipes WHERE user_id=%s) AS recipes""",
        (user_id, user_id, user_id, user_id),
    ).fetchone()

    return {
        "menus": row["menus"],
        "today": row["today_count"],
        "ingredients": row["ingredients"],
        "recipes": row["recipes"],
    }