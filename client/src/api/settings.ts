// ===== 设置相关 API（LLM 配置 + 已应用菜单） =====
import { get, post, put } from './http';
import type { LlmConfig } from '../types';

// 获取 LLM 配置
export function getLlmConfig(): Promise<LlmConfig | null> {
  return get<LlmConfig | null>('/api/settings/llm');
}

// 保存 LLM 配置
export function saveLlmConfig(config: LlmConfig): Promise<LlmConfig> {
  return put<LlmConfig>('/api/settings/llm', config);
}

// 测试 LLM 连接
export function testLlmConnection(config: LlmConfig): Promise<{ ok: boolean; message: string }> {
  return post<{ ok: boolean; message: string }>('/api/llm/test', config);
}

// ===== 已应用菜单（跨浏览器持久化） =====

// 应用菜单数据
export interface AppliedMenu {
  menuId: number;
  startDate: string;
}

// 获取当前用户已应用的菜单
export function getAppliedMenu(): Promise<AppliedMenu | null> {
  return get<AppliedMenu | null>('/api/settings/applied-menu');
}

// 保存 / 清除当前用户已应用的菜单（menuId 传 null 则清除）
export function saveAppliedMenu(menuId: number | null, startDate = ''): Promise<AppliedMenu | null> {
  return put<AppliedMenu | null>('/api/settings/applied-menu', { menuId, startDate });
}