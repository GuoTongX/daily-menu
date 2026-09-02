// ===== 食材清单弹窗组件 =====
// 按分类分组展示食材，支持勾选（已买/已有）和导出文本
import { useState, useEffect } from 'react';
import type { IngredientItem } from '../../types';
import Icon from './Icon';

interface IngredientListModalProps {
  items: IngredientItem[];
  loading: boolean;
  onClose: () => void;
  onUpdate?: (items: IngredientItem[]) => void;
}

export default function IngredientListModal({
  items, loading, onClose, onUpdate,
}: IngredientListModalProps) {
  const [localItems, setLocalItems] = useState(items);
  const [copied, setCopied] = useState(false);

  // 当外部 items 变化时同步到本地状态（modal 复用时保持数据最新）
  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  // 切换勾选状态
  const toggleItem = (id: string) => {
    const next = localItems.map((it) =>
      it.id === id ? { ...it, checked: !it.checked } : it
    );
    setLocalItems(next);
    onUpdate?.(next);
  };

  // 按分类分组
  const grouped: Record<string, IngredientItem[]> = {};
  for (const item of localItems) {
    const cat = item.category || '其他';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  }

  // 顶部顺序（肉类 > 蔬菜 > 主食 > 调料干货 > 其他）
  const categoryOrder = ['肉类', '蔬菜', '主食', '调料干货', '其他'];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => {
      const ai = categoryOrder.indexOf(a);
      const bi = categoryOrder.indexOf(b);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    }
  );

  // 导出为文本
  const exportText = () => {
    const lines = sortedCategories.map((cat) => {
      const catItems = grouped[cat].filter((it) => !it.checked);
      if (catItems.length === 0) return null;
      return `${cat}：\n${catItems.map((it) => `  ${it.name}${it.amount ? ` ${it.amount}` : ''}`).join('\n')}`;
    }).filter(Boolean).join('\n\n');

    navigator.clipboard.writeText(lines).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  // 全选/取消全选
  const allChecked = localItems.length > 0 && localItems.every((it) => it.checked);
  const toggleAll = () => {
    const next = localItems.map((it) => ({ ...it, checked: !allChecked }));
    setLocalItems(next);
    onUpdate?.(next);
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ maxWidth: 520, width: '100%', maxHeight: '80vh', overflowY: 'auto', padding: 24, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        {/* 标题栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>采购清单</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={exportText}
              title="复制清单到剪贴板"
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <Icon name="check" size={14} />
              {copied ? '已复制' : '复制文本'}
            </button>
            <button
              onClick={onClose}
              style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)', padding: '0 4px' }}
            >
              ×
            </button>
          </div>
        </div>

        {/* 加载态 */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
            计算中...
          </div>
        ) : localItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
            暂无食材
          </div>
        ) : (
          <>
            {/* 全选 */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)' }}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />
                全选 / 取消全选
              </label>
            </div>

            {/* 分类分组 */}
            {sortedCategories.map((cat) => {
              const catItems = grouped[cat];
              const checkedCount = catItems.filter((it) => it.checked).length;
              return (
                <div key={cat} style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>{cat}</span>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {checkedCount}/{catItems.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {catItems.map((item) => (
                      <label
                        key={item.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px',
                          borderRadius: 8, background: 'var(--color-muted)', cursor: 'pointer',
                          textDecoration: item.checked ? 'line-through' : 'none',
                          opacity: item.checked ? 0.5 : 1,
                          transition: 'all 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={item.checked}
                          onChange={() => toggleItem(item.id)}
                          style={{ width: 16, height: 16, cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: 14, fontWeight: 500 }}>{item.name}</span>
                        {item.amount && (
                          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>{item.amount}</span>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* 底部提示 */}
            <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 8, padding: '8px 0' }}>
              勾选表示已购买或已有食材 · 点击「复制文本」可将未购清单复制到剪贴板
            </div>
          </>
        )}
      </div>
    </div>
  );
}