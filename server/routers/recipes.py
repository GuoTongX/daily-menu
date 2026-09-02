# ===== 食谱路由：公共 + 个人 + 收藏复制 =====
from fastapi import APIRouter, Depends, HTTPException
import pymysql
import json
from typing import List
from pydantic import BaseModel
from schemas import RecipeCreate
from deps import get_current_user_id, get_db
from utils import safe_json_loads, row_to_recipe_dict

router = APIRouter(prefix="/api/recipes", tags=["recipes"])


# 批量导入请求体
class RecipeBulkImport(BaseModel):
    recipes: List[RecipeCreate]

# 校验食谱归属：先查食谱是否存在，再判断当前用户是否有权操作
def _get_owned_recipe(recipe_id: int, user_id: int, db: pymysql.connections.Connection):
    row = db.execute(
        "SELECT id, user_id, is_public FROM recipes WHERE id=%s", (recipe_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="食谱不存在或已被删除")
    # 公共食谱只读，不可修改/删除
    if row["is_public"]:
        raise HTTPException(status_code=403, detail="公共食谱为只读，不可修改或删除")
    # 非本人食谱
    if row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="无权操作该食谱，它不是当前账户的食谱")
    return row


# 根据来源参数构造食谱查询的 WHERE 条件（使用参数化查询，避免 f-string 拼接 SQL）
def _source_query(source: str, user_id: int):
    if source == "public":
        return "(is_public=1)", []
    if source == "mine":
        return "(user_id=%s AND is_public=0 AND source_recipe_id IS NULL)", [user_id]
    if source == "favorite":
        return "(user_id=%s AND is_public=0 AND source_recipe_id IS NOT NULL)", [user_id]
    # 默认 all：我的食谱 + 公共食谱
    return "(user_id=%s OR is_public=1)", [user_id]


# 导出个人食谱（我的食谱 + 我的收藏，不含公共食谱）
@router.get("/export")
def export_recipes(
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    rows = db.execute(
        "SELECT name, category, ingredients, steps, tips, cook_time, difficulty FROM recipes "
        "WHERE user_id=%s AND is_public=0 ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()

    result = []
    for row in rows:
        result.append({
            "name": row["name"],
            "category": row["category"],
            "ingredients": safe_json_loads(row["ingredients"], []),
            "steps": safe_json_loads(row["steps"], []),
            "tips": row["tips"],
            "cookTime": row["cook_time"],
            "difficulty": row["difficulty"],
        })
    return {"recipes": result}


# 批量导入个人食谱
@router.post("/import")
def import_recipes(
    payload: RecipeBulkImport,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    imported = 0
    for recipe in payload.recipes:
        name = (recipe.name or "").strip()
        if not name:
            continue
        cook_time = recipe.cook_time or ""
        db.execute(
            """INSERT INTO recipes (user_id, name, category, ingredients, steps, tips, cook_time, difficulty)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
            (
                user_id, name, recipe.category or "家常菜",
                json.dumps(recipe.ingredients, ensure_ascii=False),
                json.dumps(recipe.steps, ensure_ascii=False),
                recipe.tips or "", cook_time, recipe.difficulty or "一般",
            ),
        )
        imported += 1
    db.commit()
    return {"imported": imported}


# 获取食谱列表（按来源筛选）
@router.get("")
def list_recipes(
    source: str = "all",
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    where, params = _source_query(source, user_id)
    rows = db.execute(
        f"SELECT id, name, category, ingredients, cook_time, difficulty, created_at, favorite, is_public, source_recipe_id "
        f"FROM recipes WHERE {where} ORDER BY created_at DESC",
        params,
    ).fetchall()

    result = []
    # 批量查询当前用户已收藏的公共食谱 ID（N+1 → 1 次查询）
    collected_ids: set[int] = set()
    for r in db.execute(
        "SELECT source_recipe_id FROM recipes WHERE user_id=%s AND source_recipe_id IS NOT NULL AND is_public=0",
        (user_id,),
    ).fetchall():
        cid = r["source_recipe_id"]
        if cid is not None:
            collected_ids.add(int(cid))

    for row in rows:
        is_public = bool(row["is_public"])
        is_collected = is_public and row["id"] in collected_ids
        d = row_to_recipe_dict(row)
        d["isCollected"] = is_collected
        result.append(d)

    return result


# 按名称搜索食谱（返回当前用户可见的完整详情，用于菜单页查看菜品详情）
@router.get("/search")
def search_recipes(
    name: str,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="搜索关键词不能为空")
    kw = f"%{name}%"
    row = db.execute(
        "SELECT * FROM recipes WHERE (user_id=%s OR is_public=1) AND name LIKE %s ORDER BY "
        "(CASE WHEN name = %s THEN 0 ELSE 1 END), id LIMIT 1",
        (user_id, kw, name),
    ).fetchone()

    if not row:
        return None

    return row_to_recipe_dict(row)


# 获取单个食谱（公共食谱任何用户可看，个人食谱仅本人）
@router.get("/{recipe_id}")
def get_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT * FROM recipes WHERE id=%s", (recipe_id,)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="食谱不存在或已被删除")

    # 公共食谱任何人都可看，个人食谱仅本人可看
    if not row["is_public"] and row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="无权访问该食谱，它不是当前账户的食谱")

    return row_to_recipe_dict(row)


# 切换收藏状态（仅个人食谱可收藏标记）
@router.put("/{recipe_id}/favorite")
def toggle_favorite(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 校验归属（不存在/公共/他人食谱均拒绝）
    _get_owned_recipe(recipe_id, user_id, db)

    row = db.execute(
        "SELECT favorite FROM recipes WHERE id=%s", (recipe_id,)
    ).fetchone()

    new_val = 0 if row["favorite"] else 1
    db.execute(
        "UPDATE recipes SET favorite=%s WHERE id=%s", (new_val, recipe_id)
    )
    db.commit()
    return {"id": recipe_id, "favorite": bool(new_val)}


# 收藏复制：把公共食谱复制到我的食谱（收藏 = 复制）
@router.post("/{recipe_id}/copy")
def copy_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT * FROM recipes WHERE id=%s AND is_public=1",
        (recipe_id,),
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="公共食谱不存在")

    # 检查是否已复制过
    existing = db.execute(
        "SELECT id FROM recipes WHERE user_id=%s AND source_recipe_id=%s",
        (user_id, recipe_id),
    ).fetchone()
    if existing:
        raise HTTPException(status_code=400, detail="你已收藏该食谱")

    cursor = db.execute(
        """INSERT INTO recipes (user_id, name, category, ingredients, steps, tips, cook_time, difficulty, favorite, source_recipe_id)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            user_id, row["name"], row["category"], row["ingredients"], row["steps"],
            row["tips"], row["cook_time"], row["difficulty"], 1, recipe_id,
        ),
    )
    db.commit()

    return {
        "id": cursor.lastrowid,
        "name": row["name"],
        "favorite": True,
        "sourceRecipeId": recipe_id,
    }


# 新增个人食谱
@router.post("")
def create_recipe(
    recipe: RecipeCreate,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 获取实际 cook_time（兼容前端 cookTime 和 cook_time 两种字段）
    cook_time = recipe.cook_time or ""
    cursor = db.execute(
        """INSERT INTO recipes (user_id, name, category, ingredients, steps, tips, cook_time, difficulty)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (
            user_id,
            recipe.name,
            recipe.category,
            json.dumps(recipe.ingredients, ensure_ascii=False),
            json.dumps(recipe.steps, ensure_ascii=False),
            recipe.tips or "",
            cook_time,
            recipe.difficulty,
        ),
    )
    db.commit()

    return {
        "id": cursor.lastrowid,
        "name": recipe.name,
        "category": recipe.category,
        "ingredients": recipe.ingredients,
        "steps": recipe.steps,
        "tips": recipe.tips,
        "cookTime": cook_time,
        "difficulty": recipe.difficulty,
        "isPublic": False,
        "sourceRecipeId": None,
    }


# 删除个人食谱（公共食谱不可删）
@router.delete("/{recipe_id}")
def delete_recipe(
    recipe_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 校验归属（不存在/公共/他人食谱均拒绝）
    _get_owned_recipe(recipe_id, user_id, db)

    db.execute("DELETE FROM recipes WHERE id=%s", (recipe_id,))
    db.commit()
    return {"ok": True}
