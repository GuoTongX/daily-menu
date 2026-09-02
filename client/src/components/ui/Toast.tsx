// ===== Toast 提示组件（统一风格） =====
import { useState, useEffect } from 'react';
import Icon from './Icon';
import type { IconName } from './Icon';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info';
}

let toastId = 0;
let toastFns: { add: (msg: Omit<ToastMessage, 'id'>) => void } | null = null;

export function showToast(text: string, type: 'success' | 'error' | 'info' = 'success') {
  toastFns?.add({ text, type });
}

// 每种类型的图标与配色（对齐项目主题变量）
const TYPE_STYLE: Record<ToastMessage['type'], { icon: IconName; bg: string; color: string }> = {
  success: { icon: 'check', bg: 'var(--color-primary-subtle)', color: 'var(--color-primary)' },
  error: { icon: 'alert-circle', bg: 'var(--color-danger-bg)', color: 'var(--color-danger)' },
  info: { icon: 'info', bg: 'var(--color-muted)', color: 'var(--color-text-muted)' },
};

export default function Toast() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    toastFns = {
      add: (msg) => {
        const id = ++toastId;
        setMessages((prev) => [...prev, { ...msg, id }]);
        setTimeout(() => {
          setMessages((prev) => prev.filter((m) => m.id !== id));
        }, 3000);
      },
    };
    return () => { toastFns = null; };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 360,
    }}>
      {messages.map((msg) => {
        const s = TYPE_STYLE[msg.type];
        return (
          <div
            key={msg.id}
            style={{
              padding: '11px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
              boxShadow: 'var(--shadow-card-hover)',
              background: s.bg, color: s.color,
              border: `1px solid ${msg.type === 'success' ? 'var(--color-primary-border)' : msg.type === 'error' ? 'var(--color-danger-border)' : 'var(--color-border)'}`,
              display: 'flex', alignItems: 'center', gap: 8,
              animation: 'slideIn 0.25s ease-out',
            }}
          >
            <Icon name={s.icon} size={16} color={s.color} />
            <span>{msg.text}</span>
          </div>
        );
      })}
    </div>
  );
}
