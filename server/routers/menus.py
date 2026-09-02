# ===== 菜单路由：生成 / 列表 / 详情 / 删除 =====
from fastapi import APIRouter, Depends, HTTPException
import pymysql
import json
from schemas import MenuConfig
from deps import get_current_user_id, get_db, get_user_llm_config
from services.llm_client import chat_completion, LLMError
from services.prompt_builder import MENU_SYSTEM_PROMPT, build_menu_prompt, parse_llm_json
from utils import safe_json_loads

router = APIRouter(prefix="/api/menus", tags=["menus"])



# 生成菜单（只生成不保存，供预览）
@router.post("/preview")
def generate_menu(
    config: MenuConfig,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 获取用户的 LLM 配置
    llm_config = get_user_llm_config(user_id, db)

    # 菜单重名检测（同用户下不允许重复菜单名）
    menu_name = (config.menuName or "").strip()
    if menu_name:
        dup = db.execute(
            "SELECT id FROM menus WHERE user_id=%s AND name=%s",
            (user_id, menu_name),
        ).fetchone()
        if dup:
            raise HTTPException(status_code=400, detail=f"菜单名称「{menu_name}」已存在，请更换")

    # 获取食谱库中的菜名列表（按 recipeSource 过滤，菜单只能从这些菜中选择）
    source = getattr(config, "recipeSource", None) or "all"
    if source == "public":
        recipe_rows = db.execute(
            "SELECT name FROM recipes WHERE is_public=1 AND name IS NOT NULL AND name!=''",
        ).fetchall()
    elif source == "mine":
        recipe_rows = db.execute(
            "SELECT name FROM recipes WHERE user_id=%s AND is_public=0 AND source_recipe_id IS NULL AND name IS NOT NULL AND name!=''",
            (user_id,),
        ).fetchall()
    elif source == "favorite":
        recipe_rows = db.execute(
            "SELECT name FROM recipes WHERE user_id=%s AND is_public=0 AND source_recipe_id IS NOT NULL AND name IS NOT NULL AND name!=''",
            (user_id,),
        ).fetchall()
    else:  # all
        recipe_rows = db.execute(
            "SELECT name FROM recipes WHERE (user_id=%s OR is_public=1) AND name IS NOT NULL AND name!=''",
            (user_id,),
        ).fetchall()
    recipe_names = [r["name"] for r in recipe_rows if r["name"].strip()]

    # 构建 prompt（含食谱库约束）
    messages = [
        {"role": "system", "content": MENU_SYSTEM_PROMPT},
        {"role": "user", "content": build_menu_prompt(config.model_dump(), recipe_names, menu_name)},
    ]

    # 调用 LLM（params 是用户配置的完整请求参数，直接透传）
    try:
        content = chat_completion(
            base_url=llm_config["baseUrl"],
            api_key=llm_config["apiKey"],
            params=llm_config.get("params", {}),
            messages=messages,
        )
    except LLMError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # 解析 JSON
    try:
        menu_data = parse_llm_json(content)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"模型返回格式异常: {str(e)}")

    # 不保存，直接返回供预览
    return {
        "id": None,
        "name": menu_name,
        "config": config.model_dump(),
        "days": menu_data.get("days", []),
        "createdAt": None,
    }


# 确认保存已生成的菜单
@router.post("/save")
def save_menu(
    payload: dict,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    name = (payload.get("name") or "").strip()
    config_data = payload.get("config") or {}
    days = payload.get("days") or []

    if not name:
        raise HTTPException(status_code=400, detail="菜单名称不能为空")
    if not days or not isinstance(days, list):
        raise HTTPException(status_code=400, detail="菜单数据无效")

    # 重名检测
    dup = db.execute(
        "SELECT id FROM menus WHERE user_id=%s AND name=%s",
        (user_id, name),
    ).fetchone()
    if dup:
        raise HTTPException(status_code=400, detail=f"菜单名称「{name}」已存在，请更换")

    cursor = db.execute(
        "INSERT INTO menus (user_id, name, config, data) VALUES (%s, %s, %s, %s)",
        (user_id, name, json.dumps(config_data, ensure_ascii=False),
         json.dumps({"days": days}, ensure_ascii=False)),
    )
    db.commit()

    menu_id = cursor.lastrowid
    created = db.execute(
        "SELECT created_at FROM menus WHERE id=%s", (menu_id,)
    ).fetchone()
    return {
        "id": menu_id,
        "name": name,
        "config": config_data,
        "days": days,
        "createdAt": created["created_at"] if created else None,
    }


# 获取菜单列表
@router.get("")
def list_menus(
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    rows = db.execute(
        "SELECT id, name, config, data, created_at FROM menus WHERE user_id=%s ORDER BY created_at DESC",
        (user_id,),
    ).fetchall()

    result = []
    for row in rows:
        config_data = safe_json_loads(row["config"])
        menu_data = safe_json_loads(row["data"], {})
        if config_data is None or menu_data is None:
            continue

        result.append({
            "id": row["id"],
            "name": row["name"],
            "config": config_data,
            "days": menu_data.get("days", []),
            "createdAt": row["created_at"],
        })

    return result


# 校验菜单归属：不存在返回 404，用户无权访问他人菜单返回 403
def _get_owned_menu(menu_id: int, user_id: int, db: pymysql.connections.Connection):
    row = db.execute(
        "SELECT id, user_id, name, config, data, created_at FROM menus WHERE id=%s",
        (menu_id,),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="菜单不存在或已被删除")
    if row["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="无权访问该菜单，它不是当前账户的菜单")
    return row


# 获取单个菜单
@router.get("/{menu_id}")
def get_menu(
    menu_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = _get_owned_menu(menu_id, user_id, db)

    config_data = safe_json_loads(row["config"])
    menu_data = safe_json_loads(row["data"], {})
    if config_data is None:
        raise HTTPException(status_code=500, detail="菜单数据异常")

    return {
        "id": row["id"],
        "name": row["name"],
        "config": config_data,
        "days": menu_data.get("days", []),
        "createdAt": row["created_at"],
    }


# 删除菜单
@router.delete("/{menu_id}")
def delete_menu(
    menu_id: int,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 校验归属（不存在或非本人菜单都拒绝）
    _get_owned_menu(menu_id, user_id, db)

    # 同时清理关联的食材清单
    db.execute("DELETE FROM ingredient_lists WHERE menu_id=%s", (menu_id,))

    db.execute("DELETE FROM menus WHERE id=%s", (menu_id,))
    db.commit()
    return {"ok": True}