# ===== 已应用菜单路由（跨浏览器持久化） =====
from fastapi import APIRouter, Depends, HTTPException
import pymysql
import json
from typing import Optional
from pydantic import BaseModel
from deps import get_current_user_id, get_db

router = APIRouter(prefix="/api/settings", tags=["settings"])

# ===== 已应用菜单（跨浏览器持久化） =====

# 已应用菜单请求体
class AppliedMenuUpdate(BaseModel):
    menuId: Optional[int] = None
    startDate: str = ""


# 获取当前用户已应用的菜单
@router.get("/applied-menu")
def get_applied_menu(
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    row = db.execute(
        "SELECT applied_menu FROM user_settings WHERE user_id=%s", (user_id,)
    ).fetchone()
    if not row or not row["applied_menu"]:
        return None
    try:
        return json.loads(row["applied_menu"])
    except json.JSONDecodeError:
        return None


# 保存 / 清除当前用户已应用的菜单（menuId 为空则清除）
@router.put("/applied-menu")
def save_applied_menu(
    req: AppliedMenuUpdate,
    user_id: int = Depends(get_current_user_id),
    db: pymysql.connections.Connection = Depends(get_db),
):
    if req.menuId is None:
        result = None
    else:
        result = json.dumps({"menuId": req.menuId, "startDate": req.startDate}, ensure_ascii=False)
    db.execute(
        "UPDATE user_settings SET applied_menu=%s WHERE user_id=%s",
        (result, user_id),
    )
    db.commit()
    return None if req.menuId is None else {"menuId": req.menuId, "startDate": req.startDate}
