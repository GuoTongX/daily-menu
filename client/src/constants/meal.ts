// ===== 餐次常量 =====

export const MEAL_COLORS: Record<string, string> = {
  早餐: '#d97706',
  午餐: 'var(--color-primary)',
  晚餐: '#dc2626',
  加餐: '#7c3aed',
};

export const MEAL_TYPES = ['早餐', '午餐', '晚餐', '加餐'] as const;

export const TASTE_OPTIONS = ['清淡', '家常', '鲜美', '浓郁'] as const;