// ===== 采购清单页面：从菜单或食谱查看 =====
import { useState, useEffect } from 'react';
import { getMenus } from '../api/menus';
import { getRecipes } from '../api/recipes';
import { generateIngredients, generateIngredientsFromRecipes } from '../api/ingredients';
import IngredientListModal from '../components/ui/IngredientListModal';
import { CATEGORIES_WITH_ALL, TIME_OPTIONS, DIFFICULTIES, parseMinutes } from '../constants/recipe';
import { formatDateShort } from '../utils/date';
import type { MenuPlan, Recipe, IngredientItem } from '../types';

export default function ShoppingList() {
  const [tab, setTab] = useState<'menu' | 'recipe'>('menu');

  // 菜单来源
  const [menus, setMenus] = useState<MenuPlan[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number>(0);

  // 食谱来源
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('全部');
  const [filterTime, setFilterTime] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // 清单弹窗
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listItems, setListItems] = useState<IngredientItem[]>([]);
  const [listLoading, setListLoading] = useState(false);

  const [error, setError] = useState('');

  // 加载数据
  useEffect(() => {
    getMenus().then(setMenus).catch(() => {});
  }, []);

  // 加载食谱（切换分类时刷新）
  useEffect(() => {
    getRecipes('all').then(setRecipes).catch(() => {});
  }, []);

  // 切换食谱选中
  const toggleRecipe = (id: number) => {
    setSelectedRecipeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 从菜单生成清单
  const handleGenerateFromMenu = async () => {
    if (!selectedMenuId) { setError('请先选择一个菜单'); return; }
    setError('');
    setListLoading(true);
    try {
      const result = await generateIngredients(selectedMenuId);
      setListItems(result.items);
      setListModalOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  };

  // 从食谱生成清单
  const handleGenerateFromRecipes = async () => {
    if (selectedRecipeIds.size === 0) { setError('请先选择至少一个食谱'); return; }
    setError('');
    setListLoading(true);
    try {
      const result = await generateIngredientsFromRecipes([...selectedRecipeIds]);
      setListItems(result.items);
      setListModalOpen(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setListLoading(false);
    }
  };

  // 更新勾选状态
  const handleUpdateItems = (items: IngredientItem[]) => {
    setListItems(items);
  };

  const menuLabel = (m: MenuPlan) => m.name || `${formatDateShort(m.config.startDate)} 起`;

  // 过滤食谱：搜索 + 分类 + 时间 + 难度
  const filtered = recipes.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (category !== '全部' && r.category !== category) return false;
    if (filterTime) {
      const minutes = parseMinutes(r.cookTime);
      const opt = TIME_OPTIONS.find((o) => o.label === filterTime);
      if (opt && !opt.test(minutes)) return false;
    }
    if (filterDifficulty && r.difficulty !== filterDifficulty) return false;
    return true;
  });

  // 最多显示 10 条
  const displayed = filtered.slice(0, 10);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>采购清单</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>从所选菜单或食谱查看一份可勾选、可复制的采购清单。</p>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
          border: '1px solid var(--color-danger-border)', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* 来源切换 */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
        {(['menu', 'recipe'] as const).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setError(''); }}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: 'none', fontFamily: 'inherit',
              background: tab === t ? 'var(--color-primary)' : 'var(--color-surface)',
              color: tab === t ? 'white' : 'var(--color-text-muted)',
            }}
          >
            {t === 'menu' ? '从菜单查看' : '从食谱查看'}
          </button>
        ))}
      </div>

      {/* 从菜单查看 */}
      {tab === 'menu' && (
        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
          <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 8, display: 'block', color: 'var(--color-text-muted)' }}>
            选择已有菜单
          </label>
          <select
            value={selectedMenuId}
            onChange={(e) => setSelectedMenuId(Number(e.target.value))}
            style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 14, background: 'var(--color-surface)' }}
          >
            <option value={0}>请选择菜单...</option>
            {menus.map((m) => (
              <option key={m.id} value={m.id}>
                {menuLabel(m)}（{m.config.planDays} 天 · {m.config.peopleCount} 人）
              </option>
            ))}
          </select>
          {menus.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 8 }}>还没有菜单，请先到「菜单」页生成一份。</p>
          )}
          <button
            onClick={handleGenerateFromMenu}
            disabled={listLoading || !selectedMenuId}
            style={{
              marginTop: 16, padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 'var(--radius-btn)',
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)',
              opacity: listLoading || !selectedMenuId ? 0.6 : 1,
            }}
          >
            {listLoading ? '计算中...' : '查看采购清单'}
          </button>
        </div>
      )}

      {/* 从食谱查看 */}
      {tab === 'recipe' && (
        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
          {/* 搜索框 */}
          <div style={{ marginBottom: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索食谱..."
              maxLength={30}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)', boxSizing: 'border-box' }}
            />
          </div>

          {/* 筛选行：分类 | 烹饪时间 | 难度 */}
          <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', minWidth: 40, flexShrink: 0 }}>分类</span>
              {CATEGORIES_WITH_ALL.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  style={{
                    padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 999, border: '1px solid var(--color-border)',
                    background: category === c ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: category === c ? 'white' : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{c}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', minWidth: 40, flexShrink: 0 }}>时间</span>
              {['全部', ...TIME_OPTIONS.map((o) => o.label)].map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterTime(t === '全部' ? '' : t)}
                  style={{
                    padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 999, border: '1px solid var(--color-border)',
                    background: (t === '全部' ? !filterTime : filterTime === t) ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: (t === '全部' ? !filterTime : filterTime === t) ? 'white' : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{t}</button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', minWidth: 40, flexShrink: 0 }}>难度</span>
              {['全部', ...DIFFICULTIES].map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDifficulty(d === '全部' ? '' : d)}
                  style={{
                    padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 999, border: '1px solid var(--color-border)',
                    background: (d === '全部' ? !filterDifficulty : filterDifficulty === d) ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: (d === '全部' ? !filterDifficulty : filterDifficulty === d) ? 'white' : 'var(--color-text-muted)',
                    transition: 'all 0.15s',
                  }}
                >{d}</button>
              ))}
            </div>
          </div>

          {/* 已选提示 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              已选 {selectedRecipeIds.size} 道，{filtered.length > 10 ? '仅展示前 10 条' : `共 ${filtered.length} 条`}
            </span>
            <button
              onClick={() => setSelectedRecipeIds(new Set())}
              style={{ padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
            >
              清空
            </button>
          </div>

          {displayed.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--color-text-subtle)', textAlign: 'center', padding: 24 }}>
              {search || category !== '全部' ? '未找到匹配的食谱，请调整筛选条件' : '还没有食谱，请先到「食谱库」添加。'}
            </p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 16 }}>
              {displayed.map((r) => {
                const selected = selectedRecipeIds.has(r.id);
                return (
                  <label
                    key={r.id}
                    onClick={() => toggleRecipe(r.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                      borderRadius: 8, cursor: 'pointer',
                      border: selected ? '1px solid var(--color-primary)' : '1px solid var(--color-border)',
                      background: selected ? 'var(--color-primary-subtle)' : 'var(--color-surface)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <input type="checkbox" checked={selected} readOnly style={{ width: 16, height: 16, cursor: 'pointer' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-subtle)' }}>{r.category}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          <button
            onClick={handleGenerateFromRecipes}
            disabled={listLoading || selectedRecipeIds.size === 0}
            style={{
              padding: '9px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 'var(--radius-btn)',
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)',
              opacity: listLoading || selectedRecipeIds.size === 0 ? 0.6 : 1,
            }}
          >
            {listLoading ? '计算中...' : '查看所选食谱清单'}
          </button>
        </div>
      )}

      {/* 清单弹窗 */}
      {listModalOpen && (
        <IngredientListModal
          items={listItems}
          loading={listLoading}
          onClose={() => setListModalOpen(false)}
          onUpdate={handleUpdateItems}
        />
      )}
    </div>
  );
}