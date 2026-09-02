// ===== 日期工具函数 =====

export function formatDate(dateStr: string): string {
  const dt = new Date(dateStr);
  return dt instanceof Date && !isNaN(dt.getTime())
    ? dt.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })
    : dateStr;
}

export function formatDateShort(dateStr: string): string {
  const dt = new Date(dateStr);
  if (isNaN(dt.getTime())) return dateStr;
  return `${dt.getMonth() + 1}月${dt.getDate()}日`;
}