// ===== 菜单相关 API =====
import { get, post, del } from './http';
import type { MenuPlan, MenuConfig } from '../types';

// 生成菜单（预览，不保存）
export function generateMenu(config: MenuConfig): Promise<MenuPlan> {
  return post<MenuPlan>('/api/menus/preview', config);
}

// 确认保存已生成的菜单
export function saveMenu(data: { name: string; config: MenuConfig; days: MenuPlan['days'] }): Promise<MenuPlan> {
  return post<MenuPlan>('/api/menus/save', data);
}

// 获取菜单历史列表
export function getMenus(): Promise<MenuPlan[]> {
  return get<MenuPlan[]>('/api/menus');
}

// 获取单个菜单
export function getMenu(id: number): Promise<MenuPlan> {
  return get<MenuPlan>(`/api/menus/${id}`);
}

// 删除菜单
export function deleteMenu(id: number): Promise<void> {
  return del<void>(`/api/menus/${id}`);
}