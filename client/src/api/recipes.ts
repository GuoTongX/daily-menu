// ===== 食谱相关 API（公共 + 个人 + 收藏复制）=====
import { get, post, put, del } from './http';
import type { Recipe } from '../types';

// 获取食谱列表（按来源筛选）
export function getRecipes(source: string = 'all'): Promise<Recipe[]> {
  return get<Recipe[]>(`/api/recipes?source=${source}`);
}

// 获取单个食谱
export function getRecipe(id: number): Promise<Recipe> {
  return get<Recipe>(`/api/recipes/${id}`);
}

// 按名称搜索食谱（返回第一个匹配项或 null）
export function searchRecipe(name: string): Promise<Recipe | null> {
  return get<Recipe | null>(`/api/recipes/search?name=${encodeURIComponent(name)}`);
}

// 新增食谱
export function createRecipe(recipe: Partial<Recipe>): Promise<Recipe> {
  return post<Recipe>('/api/recipes', recipe);
}

// 删除食谱
export function deleteRecipe(id: number): Promise<void> {
  return del<void>(`/api/recipes/${id}`);
}

// 切换收藏状态
export function toggleFavorite(id: number): Promise<{ id: number; favorite: boolean }> {
  return put<{ id: number; favorite: boolean }>(`/api/recipes/${id}/favorite`, {});
}

// 收藏复制：将公共食谱复制到我的食谱
export function copyRecipe(id: number): Promise<{ id: number; name: string; favorite: boolean; sourceRecipeId: number }> {
  return post<{ id: number; name: string; favorite: boolean; sourceRecipeId: number }>(`/api/recipes/${id}/copy`, {});
}

// 导出个人食谱（JSON）
export function exportRecipes(): Promise<{ recipes: Partial<Recipe>[] }> {
  return get<{ recipes: Partial<Recipe>[] }>('/api/recipes/export');
}

// 批量导入个人食谱（JSON）
export function importRecipes(recipes: Partial<Recipe>[]): Promise<{ imported: number }> {
  return post<{ imported: number }>('/api/recipes/import', { recipes });
}