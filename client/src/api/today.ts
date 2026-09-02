// ===== 今日计划相关 API =====
import { get, post } from './http';
import type { TodayPlan, Dish } from '../types';

// 获取某天的计划
export function getToday(date: string): Promise<TodayPlan | null> {
  return get<TodayPlan | null>(`/api/today?date=${date}`);
}

// 生成今日计划
export function generateToday(date: string): Promise<TodayPlan> {
  return post<TodayPlan>('/api/today/generate', { date });
}

// 随机推荐一道菜
export function randomDish(options: { mealType: string; taste: string }): Promise<Dish & { reason: string }> {
  return post<Dish & { reason: string }>('/api/today/random-dish', options);
}