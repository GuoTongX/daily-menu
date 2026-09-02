// ===== 食材清单相关 API =====
import { get, post, del } from './http';
import type { IngredientList, IngredientItem, MenuPlan } from '../types';

// 根据菜单生成食材清单
export function generateIngredients(menuId: number): Promise<IngredientList> {
  return post<IngredientList>('/api/ingredients/generate', { menuId });
}

// 根据完整菜单数据直接生成食材清单（不落库，支持草稿菜单）
export function generateIngredientsFromMenu(menu: MenuPlan): Promise<{ items: IngredientItem[] }> {
  return post<{ items: IngredientItem[] }>('/api/ingredients/from-menu', {
    name: menu.name,
    config: menu.config,
    days: menu.days,
  });
}

// 根据多个食谱汇总食材清单
export function generateIngredientsFromRecipes(recipeIds: number[]): Promise<{ items: IngredientItem[]; source: string }> {
  return post<{ items: IngredientItem[]; source: string }>('/api/ingredients/from-recipes', { recipe_ids: recipeIds });
}

// 获取某菜单的食材清单
export function getIngredients(menuId: number): Promise<IngredientList | null> {
  return get<IngredientList | null>(`/api/ingredients?menu_id=${menuId}`);
}

// 更新食材勾选状态
export function updateIngredients(
  id: number,
  items: IngredientItem[],
): Promise<{ ok: boolean; items: IngredientItem[] }> {
  return post<{ ok: boolean; items: IngredientItem[] }>(`/api/ingredients/${id}`, { items });
}

// 删除食材清单
export function deleteIngredients(id: number): Promise<void> {
  return del<void>(`/api/ingredients/${id}`);
}