// ===== 食谱详情弹窗（可复用，供食谱库和菜单页使用）=====
import { useCallback } from 'react';
import type { Recipe } from '../../types';

interface RecipeModalProps {
  recipe: Recipe | null;
  onClose: () => void;
  onCopy?: (id: number) => void;
  onToggleFavorite?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export default function RecipeModal({ recipe, onClose, onCopy, onToggleFavorite, onDelete }: RecipeModalProps) {
  const handleCopy = useCallback(() => {
    if (recipe && onCopy) onCopy(recipe.id);
  }, [recipe, onCopy]);

  const handleToggleFavorite = useCallback(() => {
    if (recipe && onToggleFavorite) onToggleFavorite(recipe.id);
  }, [recipe, onToggleFavorite]);

  const handleDelete = useCallback(() => {
    if (recipe && onDelete) onDelete(recipe.id);
  }, [recipe, onDelete]);

  if (!recipe) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '100%', maxHeight: '82vh', overflowY: 'auto', padding: 24, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>{recipe.name}</h2>
            <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--color-text-muted)', marginTop: 4, flexWrap: 'wrap' }}>
              <span>{recipe.category}</span>
              {recipe.cookTime && <><span>|</span><span>{recipe.cookTime}</span></>}
              <span>|</span>
              <span>{recipe.difficulty}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', fontSize: 20, cursor: 'pointer', color: 'var(--color-text-muted)' }}>×</button>
        </div>

        {/* 食材（含用量） */}
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>食材与用量</h3>
        {recipe.ingredients && recipe.ingredients.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8, marginBottom: 20 }}>
            {recipe.ingredients.map((ing, i) => (
              <div key={i} style={{ padding: '8px 12px', borderRadius: 8, background: 'var(--color-muted)', fontSize: 13 }}>
                <div style={{ fontWeight: 500 }}>{ing}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>暂无食材信息</p>
        )}

        {/* 做法步骤 */}
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>做法步骤</h3>
        {recipe.steps && recipe.steps.length > 0 ? (
          <ol style={{ paddingLeft: 20, fontSize: 13, lineHeight: 1.8, marginBottom: 20 }}>
            {recipe.steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>暂无做法，请在新增时补充。</p>
        )}

        {/* 小贴士 */}
        {recipe.tips && (
          <>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>小贴士</h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20, background: 'var(--color-primary-subtle)', padding: '10px 14px', borderRadius: 8 }}>
              {recipe.tips}
            </p>
          </>
        )}

        {/* 操作按钮 */}
        {onCopy && recipe.isPublic && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={handleCopy}
              disabled={recipe.isCollected}
              style={{
                padding: '8px 16px', fontSize: 13, cursor: recipe.isCollected ? 'default' : 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: recipe.isCollected ? '1px solid var(--color-border)' : '1px solid var(--color-primary)',
                color: recipe.isCollected ? 'var(--color-text-muted)' : 'var(--color-primary)',
                background: recipe.isCollected ? 'var(--color-muted)' : 'var(--color-primary-subtle)',
                opacity: recipe.isCollected ? 0.7 : 1,
              }}
            >
              {recipe.isCollected ? '已收藏到我的食谱' : '收藏到我的食谱'}
            </button>
          </div>
        )}
        {onToggleFavorite && !recipe.isPublic && (
          <div style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={handleToggleFavorite}
              style={{
                padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: '1px solid var(--color-border)',
                background: recipe.favorite ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                color: recipe.favorite ? '#f59e0b' : 'var(--color-text-muted)',
              }}
            >
              {recipe.favorite ? '★ 已收藏' : '☆ 收藏'}
            </button>
            {onDelete && (
              <button
                onClick={handleDelete}
                style={{
                  padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  borderRadius: 6, border: '1px solid var(--color-danger-border)',
                  color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                }}
              >删除食谱</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}