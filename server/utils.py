# ===== 共享工具函数 =====
import json
import re
from typing import Any, Optional


# 密码规则：8-12 位，仅限字母+数字，且必须同时包含字母和数字（区分大小写）
def password_error(password: str) -> Optional[str]:
    """校验密码，合法返回 None，非法返回友好错误提示"""
    if not password:
        return "请输入密码"
    if len(password) < 8 or len(password) > 12:
        return "密码需为 8-12 位"
    if not re.fullmatch(r"[A-Za-z0-9]+", password):
        return "密码只能包含字母和数字"
    if not re.search(r"[A-Za-z]", password) or not re.search(r"[0-9]", password):
        return "密码需同时包含字母和数字"
    return None


def safe_json_loads(text: Optional[str], default: Any = None) -> Any:
    """安全地解析 JSON 字符串，失败时返回默认值"""
    if not text:
        return default
    try:
        return json.loads(text)
    except (json.JSONDecodeError, TypeError):
        return default


def row_to_recipe_dict(row) -> dict:
    """将 recipes 表的行转换为标准响应字典"""
    d = dict(row)  # DictCursor 行 -> dict 以便使用 .get()
    ings = safe_json_loads(d.get("ingredients"), []) if d.get("ingredients") else []
    steps = safe_json_loads(d.get("steps"), []) if d.get("steps") else []
    return {
        "id": d["id"],
        "name": d["name"],
        "category": d["category"],
        "ingredients": ings if isinstance(ings, list) else [],
        "steps": steps if isinstance(steps, list) else [],
        "tips": d.get("tips", ""),
        "cookTime": d.get("cook_time", ""),
        "difficulty": d.get("difficulty", ""),
        "createdAt": d.get("created_at", ""),
        "favorite": bool(d.get("favorite", 0)),
        "isPublic": bool(d.get("is_public", 0)),
        "sourceRecipeId": d.get("source_recipe_id", None),
    }