# ===== 今日计划路由 =====
from fastapi import APIRouter, Depends, HTTPException
import pymysql
import json
from datetime import datetime
from schemas import TodayGenerateRequest, RandomDishRequest
from deps import get_current_user_id, get_db, get_user_llm_config
from utils import safe_json_loads
from services.llm_client import chat_completion, LLMError
from services.prompt_builder import TODAY_SYSTEM_PROMPT, build_today_prompt, RANDOM_DISH_SYSTEM_PROMPT, build_random_dish_prompt, parse_llm_json

router = APIRouter(prefix="/api/today", tags=["today"])


# 校验日期格式（YYYY-MM-DD）
def _validate_date(date_str: str):
    if not date_str or not isinstance(date_str, str):
        raise HTTPException(status_code=400, detail="日期格式无效，应为 YYYY-MM-DD")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"日期格式无效：{date_str}，应为 YYYY-MM-DD")


# 生成今日计划
@router.post("/generate")
def generate_today(
    req: TodayGenerateRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 校验日期格式
    _validate_date(req.date)

    # 检查是否已生成
    existing = db.execute(
        "SELECT data FROM today_plans WHERE user_id=%s AND date=%s", (user_id, req.date)
    ).fetchone()
    if existing:
        # 已存在，先删除再重新生成
        db.execute("DELETE FROM today_plans WHERE user_id=%s AND date=%s", (user_id, req.date))
        db.commit()

    # 获取 LLM 配置
    llm_config = get_user_llm_config(user_id, db)

    # 获取用户最近菜单的配置（含忌口/口味），用于今日生成保持一致
    recent_menu = db.execute(
        "SELECT config FROM menus WHERE user_id=%s ORDER BY created_at DESC LIMIT 1",
        (user_id,),
    ).fetchone()
    user_config = safe_json_loads(recent_menu["config"]) if recent_menu else None

    # 构建 prompt
    messages = [
        {"role": "system", "content": TODAY_SYSTEM_PROMPT},
        {"role": "user", "content": build_today_prompt(req.date, user_config)},
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
        plan_data = parse_llm_json(content)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"模型返回格式异常: {str(e)}")

    # 保存
    cursor = db.execute(
        "INSERT INTO today_plans (user_id, date, data) VALUES (%s, %s, %s)",
        (user_id, req.date, json.dumps(plan_data, ensure_ascii=False)),
    )
    db.commit()

    return {
        "id": cursor.lastrowid,
        "date": req.date,
        "meals": plan_data.get("meals", []),
    }


# 获取某天的计划
@router.get("")
def get_today(
    date: str,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    # 校验日期格式
    _validate_date(date)

    row = db.execute(
        "SELECT id, date, data, note FROM today_plans WHERE user_id=%s AND date=%s",
        (user_id, date),
    ).fetchone()

    if not row:
        return None

    return {
        "id": row["id"],
        "date": row["date"],
        "meals": safe_json_loads(row["data"], {}).get("meals", []),
        "note": row["note"],
    }


# 随机推荐一道菜
@router.post("/random-dish")
def random_dish(
    req: RandomDishRequest,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    llm_config = get_user_llm_config(user_id, db)

    # 获取用户食谱库
    recipe_rows = db.execute(
        "SELECT name FROM recipes WHERE user_id=%s AND name IS NOT NULL AND name!=''",
        (user_id,),
    ).fetchall()
    recipe_names = [r["name"] for r in recipe_rows if r["name"].strip()]

    messages = [
        {"role": "system", "content": RANDOM_DISH_SYSTEM_PROMPT},
        {"role": "user", "content": build_random_dish_prompt(req.mealType, req.taste, recipe_names)},
    ]

    try:
        content = chat_completion(
            base_url=llm_config["baseUrl"],
            api_key=llm_config["apiKey"],
            params=llm_config.get("params", {}),
            messages=messages,
        )
    except LLMError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    try:
        dish_data = parse_llm_json(content)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=500, detail=f"模型返回格式异常: {str(e)}")

    return dish_data