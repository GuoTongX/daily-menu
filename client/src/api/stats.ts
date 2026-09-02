// ===== 统计相关 API =====
import { get } from './http';

// 统计数据类型
export interface Stats {
  menus: number;
  today: number;
  ingredients: number;
  recipes: number;
}

// 获取统计数据
export function getStats(): Promise<Stats> {
  return get<Stats>('/api/stats');
}