# ===== 食材清单路由 =====
from fastapi import APIRouter, Depends, HTTPException
import pymysql
import json
from schemas import IngredientGenerateRequest, RecipeIngredientGenerateRequest
from deps import get_current_user_id, get_db

router = APIRouter(prefix="/api/ingredients", tags=["ingredients"])


# 直接从菜单数据生成食材清单（不落库，支持草稿/未保存菜单）
@router.post("/from-menu")
def generate_ingredients_from_menu(
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    days = payload.get("days") or []
    if not isinstance(days, list) or not days:
        raise HTTPException(status_code=400, detail="菜单数据无效，缺少菜品信息")

    ingredient_map: dict = {}
    for day in days:
        for meal in day.get("meals", []):
            for dish in meal.get("dishes", []):
                for ing in dish.get("ingredients", []):
                    name = ing.strip()
                    if not name:
                        continue
                    if name not in ingredient_map:
                        category = classify_ingredient(name)
                        ingredient_map[name] = {
                            "id": name,
                            "name": name,
                            "category": category,
                            "amount": "",
                            "checked": False,
                        }

    items = list(ingredient_map.values())
    return {"items": items, "source": "menu"}


# 根据菜单生成食材清单
@router.post("/generate")
def generate_ingredients(
    req: IngredientGenerateRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 兼容 menu_id 和 menuId 两种前端写法
    menu_id = req.menu_id
    if not menu_id:
        raise HTTPException(status_code=400, detail="请指定菜单")

    # 获取菜单（先查存在性，再校验归属，区分「不存在」与「越权」）
    menu_row = db.execute(
        "SELECT user_id, data FROM menus WHERE id=%s", (menu_id,)
    ).fetchone()
    if not menu_row:
        raise HTTPException(status_code=404, detail="菜单不存在或已被删除")
    if menu_row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="无权操作该菜单，它不是当前账户的菜单")

    menu = menu_row

    try:
        menu_data = json.loads(menu["data"])
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="菜单数据异常")

    # 汇总食材
    ingredient_map: dict = {}
    for day in menu_data.get("days", []):
        for meal in day.get("meals", []):
            for dish in meal.get("dishes", []):
                for ing in dish.get("ingredients", []):
                    name = ing.strip()
                    if not name:
                        continue
                    if name not in ingredient_map:
                        # 粗略按名称判断分类
                        category = classify_ingredient(name)
                        ingredient_map[name] = {
                            "id": name,
                            "name": name,
                            "category": category,
                            "amount": "",
                            "checked": False,
                        }

    items = list(ingredient_map.values())

    return {
        "id": 0,
        "menuId": menu_id,
        "items": items,
    }


# 根据多个食谱汇总食材清单（从食谱库的 ingredients 字段直接读取）
@router.post("/from-recipes")
def generate_ingredients_from_recipes(
    req: RecipeIngredientGenerateRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    if not req.recipe_ids:
        raise HTTPException(status_code=400, detail="请选择至少一个食谱")

    ingredient_map: dict = {}
    invalid_ids: list[int] = []
    for rid in req.recipe_ids:
        row = db.execute(
            "SELECT user_id, is_public, name, ingredients FROM recipes WHERE id=%s",
            (rid,),
        ).fetchone()
        # 仅本人食谱或公共食谱可用于生成清单
        if not row or (not row["is_public"] and row["user_id"] != user_id):
            invalid_ids.append(rid)
            continue
        try:
            ings = json.loads(row["ingredients"]) if row["ingredients"] else []
        except json.JSONDecodeError:
            ings = []
        for ing_entry in ings:
            # 兼容 "名称 用量" 格式和纯名称格式
            name = ing_entry.strip()
            amount = ""
            if not name:
                continue
            # 尝试提取用量（格式如 "五花肉 300g"）
            parts = name.split(None, 1)
            if len(parts) > 1:
                name = parts[0]
                amount = parts[1]
            if name not in ingredient_map:
                category = classify_ingredient(name)
                ingredient_map[name] = {
                    "id": name,
                    "name": name,
                    "category": category,
                    "amount": amount,
                    "checked": False,
                }
            elif amount and not ingredient_map[name]["amount"]:
                ingredient_map[name]["amount"] = amount

    items = list(ingredient_map.values())
    result = {"items": items, "source": "recipes"}
    if invalid_ids:
        result["warning"] = f"以下食谱不存在或无权访问，已跳过：{invalid_ids}"
    return result


# 获取某菜单的食材清单
@router.get("")
def get_ingredients(
    menu_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT id, menu_id, items FROM ingredient_lists WHERE user_id=%s AND menu_id=%s",
        (user_id, menu_id),
    ).fetchone()

    if not row:
        return None

    return {
        "id": row["id"],
        "menuId": row["menu_id"],
        "items": json.loads(row["items"]),
    }


# 更新食材清单（勾选状态）
@router.post("/{list_id}")
def update_ingredients(
    list_id: int,
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT id FROM ingredient_lists WHERE id=%s AND user_id=%s", (list_id, user_id)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="清单不存在")

    items = payload.get("items", [])
    db.execute(
        "UPDATE ingredient_lists SET items=%s WHERE id=%s",
        (json.dumps(items, ensure_ascii=False), list_id),
    )
    db.commit()

    return {"ok": True, "items": items}


# 删除食材清单
@router.delete("/{list_id}")
def delete_ingredients(
    list_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT id FROM ingredient_lists WHERE id=%s AND user_id=%s", (list_id, user_id)
    ).fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="清单不存在")

    db.execute("DELETE FROM ingredient_lists WHERE id=%s", (list_id,))
    db.commit()
    return {"ok": True}


# 按名称粗略分类食材（中文规则）
def classify_ingredient(name: str) -> str:
    # 常见分类关键词
    meat_keywords = ["肉", "鸡", "鸭", "鱼", "虾", "蟹", "牛", "羊", "猪", "排骨", "培根", "火腿"]
    veg_keywords = ["菜", "瓜", "椒", "茄", "豆", "葱", "姜", "蒜", "芹", "笋", "菇", "薯", "萝卜"]
    main_keywords = ["米", "面", "馒头", "包", "粉", "饼"]
    cond_keywords = ["油", "盐", "酱", "醋", "糖", "料", "香", "味", "蚝", "淀粉"]

    if any(k in name for k in meat_keywords):
        return "肉类"
    if any(k in name for k in veg_keywords):
        return "蔬菜"
    if any(k in name for k in main_keywords):
        return "主食"
    if any(k in name for k in cond_keywords):
        return "调料干货"
    return "其他"