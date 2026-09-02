# ===== Pydantic 请求/响应模型 =====
from pydantic import BaseModel, Field, field_validator
from typing import Optional, List
from datetime import datetime


# ===== 认证相关 =====
class RegisterSendCodeRequest(BaseModel):
    username: str = Field(min_length=1, max_length=50)
    # 密码复杂度（8-12 位字母+数字）在路由处理器中校验，返回友好的中文提示
    password: str = Field(max_length=100)
    email: str = Field(max_length=255)


class RegisterConfirmRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str] = None
    email_verified: Optional[bool] = None
    is_active: Optional[bool] = None
    created_at: Optional[str] = None

    @field_validator("created_at", mode="before")
    @classmethod
    def _coerce_datetime(cls, v):
        if v is None:
            return None
        if isinstance(v, datetime):
            return v.strftime("%Y-%m-%d %H:%M:%S")
        return str(v)


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ===== LLM 配置 =====
class LlmConfig(BaseModel):
    baseUrl: str = Field(max_length=500)
    apiKey: str = Field(max_length=500)
    # params 是最终发给云模型的请求参数（不含 messages），由用户完全掌控
    params: dict = {}


# ===== 菜单 =====
class MenuConfig(BaseModel):
    peopleCount: int = Field(ge=1, le=10)
    planDays: int = Field(ge=1, le=7)
    mealsPerDay: int = Field(ge=1, le=5)
    menuName: str = ""  # 菜单名称（可选，默认自动生成）
    startDate: str
    restrictions: List[str] = []
    taste: str = "清淡"
    dishCount: str = "三菜"  # 菜品数量：一菜~五菜
    meatVegRatio: str = "两荤一素"  # 荤素配比：全素/一荤一素/两荤一素/三荤一素/全荤
    healthGoal: str = ""
    recipeSource: str = "all"  # 食谱约束来源：all/public/mine/favorite


# ===== 食材清单 =====
class IngredientGenerateRequest(BaseModel):
    menu_id: int = Field(0, alias="menuId")

    model_config = {"populate_by_name": True}


# 从多个食谱汇总食材清单的请求体
class RecipeIngredientGenerateRequest(BaseModel):
    recipe_ids: List[int] = []


# ===== 今日计划 =====
class TodayGenerateRequest(BaseModel):
    date: str


class RandomDishRequest(BaseModel):
    mealType: str = "午餐"  # 早餐/午餐/晚餐/加餐
    taste: str = "清淡"


# ===== 食谱 =====
class RecipeCreate(BaseModel):
    name: str
    category: str = "家常菜"
    ingredients: List[str] = []
    steps: List[str] = []
    tips: Optional[str] = ""
    cook_time: str = Field("", alias="cookTime")
    difficulty: str = "一般"

    model_config = {"populate_by_name": True}


# ===== LLM 测试 =====
class LlmTestResponse(BaseModel):
    ok: bool
    message: str


# ===== 账户管理 =====
class BindEmailSendCodeRequest(BaseModel):
    email: str = Field(max_length=255)
    password: str


class BindEmailConfirmRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)


# ===== 找回密码 =====
class ForgotPasswordSendCodeRequest(BaseModel):
    email: str


class ForgotPasswordResetRequest(BaseModel):
    email: str
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(max_length=100)


# ===== 修改密码 =====
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(max_length=100)


# ===== 注销账号 =====
class DeactivateSendCodeRequest(BaseModel):
    password: str


class DeactivateConfirmRequest(BaseModel):
    code: str = Field(min_length=6, max_length=6)
