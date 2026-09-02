// ===== 共享 TypeScript 类型定义 =====

// LLM 配置
// baseUrl/apiKey 用于寻址与认证；params 是最终发给云模型的请求参数（不包含 messages），由用户完全掌控
export interface LlmConfig {
  baseUrl: string;
  apiKey: string;
  params: Record<string, unknown>;
}

// 菜单生成配置
export interface MenuConfig {
  peopleCount: number;       // 用餐人数 (1-10)
  planDays: number;          // 计划天数 (1-7)
  mealsPerDay: number;       // 每天餐次 (1-5)
  menuName: string;          // 菜单名称（可选）
  startDate: string;         // 开始日期 YYYY-MM-DD
  restrictions: string[];    // 忌口列表
  taste: string;             // 口味偏好
  dishCount: string;         // 菜品数量：一菜~五菜
  meatVegRatio: string;      // 荤素配比：全素/一荤一素/两荤一素/三荤一素/全荤
  healthGoal: string;        // 健康目标
  recipeSource?: string;     // 食谱约束来源：all/public/mine/favorite
}

// 菜品
export interface Dish {
  name: string;
  description: string;
  ingredients: string[];
}

// 一餐（早餐/午餐/晚餐/加餐）
export interface Meal {
  mealType: string;   // 早餐/午餐/晚餐/加餐/夜宵
  dishes: Dish[];
}

// 一天的菜单
export interface DayMenu {
  date: string;       // YYYY-MM-DD
  meals: Meal[];
}

// 完整菜单计划
export interface MenuPlan {
  id: number;
  name: string;
  config: MenuConfig;
  days: DayMenu[];
  createdAt: string;
}

// 食材条目
export interface IngredientItem {
  id: string;
  name: string;
  category: string;    // 蔬菜/肉类/调料/主食等
  amount: string;      // 数量
  checked: boolean;    // 已买/已有
}

// 食材清单
export interface IngredientList {
  id: number;
  menuId: number;
  items: IngredientItem[];
  createdAt?: string;
}

// 今日计划
export interface TodayPlan {
  id: number;
  date: string;
  meals: Meal[];
  note?: string;
}

// 食谱
export interface Recipe {
  id: number;
  name: string;
  category: string;
  ingredients: string[];
  steps: string[];
  tips?: string;
  cookTime: string;
  difficulty: string;
  createdAt: string;
  favorite?: boolean;
  isPublic?: boolean;
  isCollected?: boolean;
  sourceRecipeId?: number | null;
}

// 用户
export interface User {
  id: number;
  username: string;
  email?: string | null;
  email_verified?: boolean;
  created_at?: string;
}

// API 响应
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

// 认证响应
export interface AuthResponse {
  token: string;
  user: User;
}