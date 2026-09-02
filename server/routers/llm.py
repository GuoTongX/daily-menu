# ===== LLM 配置与测试路由 =====
from fastapi import APIRouter, Depends, HTTPException
import pymysql
import json
from schemas import LlmConfig
from deps import get_current_user_id, get_db
from services.llm_client import test_connection

router = APIRouter(prefix="/api", tags=["llm"])

# 获取 LLM 配置
@router.get("/settings/llm")
def get_llm_config(
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT llm_config FROM user_settings WHERE user_id=%s", (user_id,)
    ).fetchone()
    if not row or not row["llm_config"]:
        return None
    try:
        return json.loads(row["llm_config"])
    except json.JSONDecodeError:
        return None


# 保存 LLM 配置
@router.put("/settings/llm")
def save_llm_config(
    config: LlmConfig,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    db.execute(
        "UPDATE user_settings SET llm_config=%s WHERE user_id=%s",
        (config.model_dump_json(), user_id),
    )
    db.commit()
    return config


# 测试 LLM 连接
@router.post("/llm/test")
def test_llm(
    config: LlmConfig,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    ok, message = test_connection(config.baseUrl, config.apiKey, config.params)
    return {"ok": ok, "message": message}