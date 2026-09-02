// ===== 统一 SVG 图标组件 =====
// 全站统一使用本组件，避免 emoji 与 SVG 混用
// 用法：<Icon name="calendar" size={18} />
import type { CSSProperties } from 'react';

// 图标名称集合
export type IconName =
  | 'dashboard'   // 总览
  | 'calendar'    // 今日/日历
  | 'menu'        // 菜单/清单
  | 'book'        // 食谱
  | 'bot'         // 模型
  | 'palette'     // 主题/调色
  | 'user'        // 账户
  | 'sparkle'     // AI/推荐
  | 'clock'       // 时间
  | 'flame'       // 难度/火候
  | 'plus'        // 新增
  | 'search'      // 搜索
  | 'trash'       // 删除
  | 'edit'        // 编辑
  | 'check'       // 勾选
  | 'close'       // 关闭
  | 'chevron-down'// 下拉
  | 'chevron-left'// 上一页
  | 'chevron-right'// 下一页
  | 'dice'        // 随机
  | 'shopping'    // 采购
  | 'tag'         // 标签
  | 'info'        // 信息
  | 'alert-circle'// 错误/警告圆形
  | 'alert-triangle'; // 警告三角

// 图标 path 映射（线性风格）
const ICON_PATHS: Record<IconName, string> = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z',
  calendar: 'M8 2v4M16 2v4M3 10h18M21 14V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-4M7 14h.01M11 14h.01M15 14h.01M7 18h.01M11 18h.01M15 18h.01',
  menu: 'M4 6h16M4 12h16M4 18h16',
  book: 'M2 4h6a4 4 0 014 4v12a4 4 0 00-4-4H2zM22 4h-6a4 4 0 00-4 4v12a4 4 0 014-4h6z',
  bot: 'M12 8V4m0 0L8 8m4-4l4 4M12 20v-8m0 0l-4 4m4-4l4 4',
  palette: 'M12 20a8 8 0 100-16 8 8 0 000 16zm0 0v-4m0 0a4 4 0 110-8 4 4 0 010 8z',
  user: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z',
  sparkle: 'M12 3l1.9 4.6L18.5 9l-4.6 1.4L12 15l-1.9-4.6L5.5 9l4.6-1.4zM19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z',
  clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  flame: 'M12 22c4 0 7-2.7 7-7 0-1.5-.8-2.8-1.6-4-.6-.9-1.1-1.8-1.1-2.9 0-2.5-1.3-4.6-3.3-6',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z',
  trash: 'M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M10 11v6M14 11v6',
  edit: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z',
  check: 'M20 6L9 17l-5-5',
  close: 'M18 6L6 18M6 6l12 12',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-left': 'M15 18l-6-6 6-6',
  'chevron-right': 'M9 18l6-6-6-6',
  dice: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 8.5h.01M8.5 15.5h.01M15.5 15.5h.01',
  shopping: 'M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0',
  tag: 'M3 3h7.6L20 12.4 12.4 20 3 10.6zM7 7h.01',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v4M12 16h.01',
  'alert-circle': 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 8v4M12 16h.01',
  'alert-triangle': 'M10.3 3.4L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.4a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}

export default function Icon({
  name,
  size = 20,
  color = 'currentColor',
  strokeWidth = 2,
  style,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name] || ICON_PATHS.tag} />
    </svg>
  );
}
