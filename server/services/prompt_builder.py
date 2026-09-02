# ===== Prompt 构建器：各场景的中文 prompt 模板 =====
import json
import re
from typing import Optional

# 菜单生成 System Prompt
MENU_SYSTEM_PROMPT = """你是一位专业的中华饮食规划师。根据用户的需求生成一份详细的菜单计划。

要求输出严格的 json 格式，不要包含任何其他文字，只输出 json 对象：
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "meals": [
        {
          "mealType": "早餐/午餐/晚餐/加餐",
          "dishes": [
            {
              "name": "菜名",
              "description": "简短描述",
              "ingredients": ["食材1", "食材2"]
            }
          ]
        }
      ]
    }
  ]
}

要求：
- 菜单要符合中国人的饮食习惯
- 营养均衡，搭配合理
- 考虑季节性和食材搭配
- 每天菜品不重复
- 严格遵守忌口要求"""

# 构建菜单生成的 User Prompt
def build_menu_prompt(config: dict, recipe_names: list = None, menu_name: str = "") -> str:
    """根据菜单配置构建用户 prompt

    recipe_names: 用户食谱库中的菜名列表，菜单只能从这些菜中选择
    menu_name: 用户命名的菜单名称
    """
    parts = [
        f"用餐人数：{config.get('peopleCount', 3)}",
        f"计划天数：{config.get('planDays', 5)}",
        f"每天餐次：{config.get('mealsPerDay', 3)}",
        f"开始日期：{config.get('startDate', '')}",
        f"口味偏好：{config.get('taste', '清淡')}",
    ]

    if menu_name:
        parts.append(f"菜单名称：{menu_name}")

    restrictions = config.get('restrictions', [])
    if restrictions:
        parts.append(f"忌口：{', '.join(restrictions)}")

    if config.get('dishCount') and config.get('meatVegRatio'):
        parts.append(f"每餐菜品数量：{config['dishCount']}，荤素配比：{config['meatVegRatio']}")

    if config.get('healthGoal'):
        parts.append(f"健康目标：{config['healthGoal']}")

    # 食谱库约束：只能从这些菜中选择
    if recipe_names:
        parts.append("可选菜品范围（只能从以下菜品中选择，不要生成列表之外的）：")
        parts.append("、".join(recipe_names))

    return "请生成一份菜单计划。\n" + "\n".join(parts)


# 今日计划 System Prompt
TODAY_SYSTEM_PROMPT = """你是一位专业的中华饮食规划师。根据用户的需求生成今日的三餐计划。

要求输出严格的 json 格式，不要包含任何其他文字，只输出 json 对象：
{
  "meals": [
    {
      "mealType": "早餐/午餐/晚餐",
      "dishes": [
        {
          "name": "菜名",
          "description": "简短描述",
          "ingredients": ["食材1", "食材2"]
        }
      ]
    }
  ]
}"""


# 今日计划 User Prompt
def build_today_prompt(date: str, config: Optional[dict] = None) -> str:
    parts = [f"日期：{date}"]
    if config:
        restrictions = config.get('restrictions', [])
        if restrictions:
            parts.append(f"忌口：{', '.join(restrictions)}")
        if config.get('taste'):
            parts.append(f"口味偏好：{config['taste']}")
    parts.append("请为今日生成三餐计划。")
    return "\n".join(parts)


# 随机推荐一道菜 System Prompt
RANDOM_DISH_SYSTEM_PROMPT = """你是一位专业的中华饮食规划师。根据用户的需求，从食谱库中推荐一道合适的菜品。

要求输出严格的 json 格式，不要包含任何其他文字，只输出 json 对象：
{
  "name": "菜名",
  "description": "简短描述",
  "ingredients": ["食材1", "食材2"],
  "reason": "推荐理由（一句话）"
}"""


# 随机推荐一道菜 User Prompt
def build_random_dish_prompt(meal_type: str, taste: str, recipe_names: list) -> str:
    """构建随机推荐一道菜的 prompt"""
    parts = [
        f"餐次类型：{meal_type}",
        f"口味偏好：{taste}",
    ]
    if recipe_names:
        parts.append("可选菜品范围（只能从以下菜品中选择，不要生成列表之外的）：")
        parts.append("、".join(recipe_names))
    parts.append("请从食谱库中推荐一道最适合的菜品。")
    return "\n".join(parts)


# 解析 LLM 返回的 JSON 内容
def parse_llm_json(text: str) -> dict:
    """从 LLM 返回文本中提取并解析 JSON"""
    # 尝试去除可能的 markdown 围栏
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"```(?:json)?\s*", "", text)
        text = text.strip()
        if text.endswith("```"):
            text = text[:-3].strip()
    return json.loads(text)