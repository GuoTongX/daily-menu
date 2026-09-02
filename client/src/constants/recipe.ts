// ===== 食谱相关常量 =====

export const CATEGORIES = [
  '热炒荤菜', '热炒素菜', '凉拌冷盘', '汤羹靓汤',
  '清蒸料理', '主食面饭', '早餐早点', '甜品糖水', '烧烤干锅', '卤味酱货',
] as const;

export const CATEGORIES_WITH_ALL = ['全部', ...CATEGORIES] as const;

export const TIME_OPTIONS = [
  { label: '15分钟内', test: (m: number) => m <= 15 },
  { label: '15~30分钟', test: (m: number) => m > 15 && m <= 30 },
  { label: '30~60分钟', test: (m: number) => m > 30 && m <= 60 },
  { label: '60分钟以上', test: (m: number) => m > 60 },
] as const;

export const DIFFICULTIES = ['简单', '普通', '困难'] as const;

export function parseMinutes(cookTime?: string): number {
  if (!cookTime) return 0;
  const m = cookTime.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}