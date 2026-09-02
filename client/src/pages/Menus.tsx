// ===== 菜单工作台页面：生成配置 + 三视图展示 + 历史 =====
import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { generateMenu, saveMenu, getMenus, deleteMenu } from '../api/menus';
import { searchRecipe } from '../api/recipes';
import { generateIngredientsFromMenu, getIngredients, updateIngredients } from '../api/ingredients';
import { saveAppliedMenu } from '../api/settings';
import Pagination from '../components/ui/Pagination';
import RecipeModal from '../components/ui/RecipeModal';
import IngredientListModal from '../components/ui/IngredientListModal';
import { showToast } from '../components/ui/Toast';
import { formatDateShort } from '../utils/date';
import type { MenuPlan, MenuConfig, IngredientItem, Recipe } from '../types';

export default function Menus() {
  const location = useLocation();
  const navigate = useNavigate();

  // 支持从模板预填配置（路由 state 传入 initialConfig）
  const initialConfig = (location.state as { initialConfig?: Partial<MenuConfig> } | null)?.initialConfig;

  const [config, setConfig] = useState<MenuConfig>({
    peopleCount: initialConfig?.peopleCount ?? 2,
    planDays: initialConfig?.planDays ?? 3,
    mealsPerDay: initialConfig?.mealsPerDay ?? 3,
    menuName: initialConfig?.menuName ?? '',
    startDate: initialConfig?.startDate ?? new Date().toISOString().slice(0, 10),
    restrictions: initialConfig?.restrictions ?? [],
    taste: initialConfig?.taste ?? '清淡',
    dishCount: initialConfig?.dishCount ?? '三菜',
    meatVegRatio: initialConfig?.meatVegRatio ?? '两荤一素',
    healthGoal: initialConfig?.healthGoal ?? '',
    recipeSource: initialConfig?.recipeSource ?? 'all',
  });

  const [menus, setMenus] = useState<MenuPlan[]>([]);
  const [currentMenu, setCurrentMenu] = useState<MenuPlan | null>(null);
  const [isDraft, setIsDraft] = useState(false); // 当前菜单是否为未保存的草稿
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({}); // 字段级错误提示
  const [info, setInfo] = useState('');
  const [view, setView] = useState<'matrix' | 'list'>('matrix');
  const [newRestriction, setNewRestriction] = useState('');
  const [restrictionFocused, setRestrictionFocused] = useState(false);

  // 食谱详情弹窗状态
  const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);

  // 采购清单弹窗状态
  const [listModalOpen, setListModalOpen] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [listItems, setListItems] = useState<IngredientItem[]>([]);

  // 加载历史菜单
  const loadMenus = useCallback(async () => {
    try {
      const list = await getMenus();
      setMenus(list);
      if (list.length > 0) {
        setCurrentMenu((prev) => prev ?? list[0]);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  // 处理生成
  const handleGenerate = async () => {
    setError('');
    setFieldErrors({});

    // 必填校验（错误提示直接显示在各字段下方）
    const errors: Record<string, string> = {};
    if (!config.menuName.trim()) {
      errors.menuName = '请填写菜单名称';
    }
    if (!config.taste) {
      errors.taste = '请选择口味偏好';
    }
    if (!config.dishCount) {
      errors.dishCount = '请选择菜品数量';
    }
    if (!config.meatVegRatio) {
      errors.meatVegRatio = '请选择荤素配比';
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      // 生成预览（未保存）
      const menu = await generateMenu(config);
      setCurrentMenu(menu);
      setIsDraft(true); // 标记为草稿，需要用户确认保存
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 保存草稿菜单
  const handleSave = async () => {
    if (!currentMenu) return;
    setLoading(true);
    setError('');
    setFieldErrors({});
    try {
      const saved = await saveMenu({
        name: currentMenu.name,
        config: currentMenu.config,
        days: currentMenu.days,
      });
      setCurrentMenu(saved);
      setIsDraft(false);
      showToast('菜单已保存', 'success');
      await loadMenus();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 取消草稿菜单（回到已保存的视图）
  const handleCancel = async () => {
    if (currentMenu?.id == null) {
      // 全新草稿（未保存过），直接清空
      setCurrentMenu(null);
      setIsDraft(false);
      setError('');
      await loadMenus();
      return;
    }
    // 已有保存版本，重新加载回原始状态
    const allMenus = await getMenus();
    const original = allMenus.find((m) => m.id === currentMenu.id);
    if (original) setCurrentMenu(original);
    setIsDraft(false);
    setError('');
  };

  // 生成采购清单：每次都根据当前菜单数据重新生成（不落库，不保存菜单）
  const handleGenerateList = async (menu?: MenuPlan) => {
    const m = menu ?? currentMenu;
    if (!m) return;
    setListLoading(true);
    setError('');
    setInfo('');
    try {
      const result = await generateIngredientsFromMenu(m);
      setListItems(result.items);
      setListModalOpen(true);
    } catch (e) {
      setError('生成清单失败: ' + (e as Error).message);
    } finally {
      setListLoading(false);
    }
  };

  // 点击菜品名称 → 在食谱库中搜索并展示详情
  const handleViewDish = async (dishName: string) => {
    setError('');
    try {
      const found = await searchRecipe(dishName);
      if (found) {
        setRecipeDetail(found);
      } else {
        setRecipeDetail(null);
        showToast(`食谱库中未找到「${dishName}」，可到食谱库中添加`, 'info');
      }
    } catch {
      setRecipeDetail(null);
      showToast('查找食谱失败', 'error');
    }
  };

  // 菜单→今日一键应用
  const handleApplyToToday = async (menu: MenuPlan) => {
    setError('');
    setInfo('');
    try {
      await saveAppliedMenu(menu.id, menu.config.startDate);
      setInfo(`已应用到今日，去看看 →`);
    } catch (e) {
      setError('应用到今日失败: ' + (e as Error).message);
    }
  };

  // 删除历史菜单
  const handleDeleteMenu = async (menu: MenuPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`确定删除菜单「${menuLabel(menu)}」？\n关联的采购清单也会被删除。`)) return;
    setError('');
    try {
      await deleteMenu(menu.id);
      showToast('菜单已删除', 'success');
      await loadMenus();
      if (currentMenu?.id === menu.id) {
        setCurrentMenu(null);
      }
    } catch (e) {
      setError('删除失败: ' + (e as Error).message);
    }
  };

  // 更新食材清单勾选状态
  const handleUpdateListItems = async (items: IngredientItem[]) => {
    setListItems(items);
    if (!currentMenu) return;
    try {
      const existing = await getIngredients(currentMenu.id);
      if (existing) {
        await updateIngredients(existing.id, items);
      }
    } catch {
      // 静默失败，不影响勾选体验
    }
  };

  // 添加/选中一个忌口标签
  const addRestriction = (r: string) => {
    const v = r.trim();
    if (v && !config.restrictions.includes(v)) {
      setConfig((c) => ({ ...c, restrictions: [...c.restrictions, v] }));
    }
    setNewRestriction('');
  };

  // 移除某个已选忌口标签
  const removeRestriction = (r: string) => {
    setConfig((c) => ({ ...c, restrictions: c.restrictions.filter((x) => x !== r) }));
  };

  const commonRestrictions = ['香菜', '辣', '海鲜', '乳糖', '花生', '蒜'];
  // 输入候选项：根据输入内容匹配预设（排除已选）
  const restrictionCandidates = newRestriction.trim()
    ? commonRestrictions.filter((r) => r.includes(newRestriction.trim()) && !config.restrictions.includes(r))
    : [];

  // 口味偏好选项（更直观的描述）
  const tasteOptions = [
    { value: '清淡', label: '清淡' },
    { value: '家常', label: '家常' },
    { value: '鲜美', label: '鲜美' },
    { value: '浓郁', label: '浓郁' },
  ];

  // 菜品数量选项
  const dishCountOptions = ['一菜', '两菜', '三菜', '四菜', '五菜'];
  // 荤素配比选项
  const meatVegOptions = ['全素', '一荤一素', '两荤一素', '三荤一素', '全荤'];

  // 通用步进组件（+/- 按钮）
  const Stepper = ({ label, value, min, max, onChange }: {
    label: string; value: number; min: number; max: number; onChange: (v: number) => void;
  }) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 32, height: 32, cursor: 'pointer', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 15, fontWeight: 500, lineHeight: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)',
          }}
        >−</button>
        <span style={{
          fontSize: 15, fontWeight: 600, minWidth: 28, textAlign: 'center',
          color: 'var(--color-text)',
        }}>{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 32, height: 32, cursor: 'pointer', borderRadius: 6,
            border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            fontSize: 15, fontWeight: 500, lineHeight: 1, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--color-text)',
          }}
        >+</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginLeft: 4 }}>
          {min}~{max}
        </span>
      </div>
    </div>
  );

  // 菜单显示名
  const menuLabel = (m: MenuPlan) => m.name || `${formatDateShort(m.config.startDate)} 起`;

  // 获取用户名
  const displayMenuName = currentMenu?.name || (currentMenu ? `${formatDateShort(currentMenu.config.startDate)} 起` : '');

  // 餐次颜色
  const mealColors: Record<string, { bg: string; label: string }> = {
    早餐: { bg: '#d97706', label: '早餐' },
    午餐: { bg: 'var(--color-primary)', label: '午餐' },
    晚餐: { bg: '#dc2626', label: '晚餐' },
    加餐: { bg: '#7c3aed', label: '加餐' },
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>菜单工作台</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>
          生成 · 编辑 · 导出 —— 把人数、口味、健康目标和真实生活场景放在一起，生成一份可以直接执行的餐食计划。
        </p>
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
      {info && (
        <div style={{
          padding: '12px 16px', marginBottom: 16, borderRadius: 8,
          background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
          border: '1px solid var(--color-primary-border)', fontSize: 13,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>{info}</span>
          {info.includes('去看看') && (
            <button
              onClick={() => navigate('/today')}
              style={{
                padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: '1px solid var(--color-primary)',
                color: 'var(--color-primary)', background: 'var(--color-surface)',
              }}
            >
              去看看
            </button>
          )}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        {/* ===== 左侧配置区 ===== */}
        <div className="card" style={{ padding: 20, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>生成配置</h3>

          {/* 菜单名称 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
              菜单名称<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span>
            </label>
            <input
              value={config.menuName}
              onChange={(e) => { setConfig((c) => ({ ...c, menuName: e.target.value })); setFieldErrors((fe) => ({ ...fe, menuName: '' })); }}
              placeholder="给这份菜单起个名字"
              maxLength={30}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 14, background: 'var(--color-surface)', boxSizing: 'border-box' }}
            />
            {config.menuName && menus.some((m) => m.name === config.menuName.trim()) && (
              <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>⚠ 该菜单名称已存在，请更换</p>
            )}
            {fieldErrors.menuName && (
              <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.menuName}</p>
            )}
          </div>

          {/* 用餐人数 */}
          <Stepper
            label="用餐人数"
            value={config.peopleCount}
            min={1}
            max={10}
            onChange={(v) => setConfig((c) => ({ ...c, peopleCount: v }))}
          />

          {/* 计划天数 */}
          <Stepper
            label="计划天数"
            value={config.planDays}
            min={1}
            max={7}
            onChange={(v) => setConfig((c) => ({ ...c, planDays: v }))}
          />

          {/* 每天餐次 */}
          <Stepper
            label="每天餐次"
            value={config.mealsPerDay}
            min={1}
            max={5}
            onChange={(v) => setConfig((c) => ({ ...c, mealsPerDay: v }))}
          />

          {/* 菜品数量 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>菜品数量<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            <div style={{ display: 'flex', gap: 4 }}>
              {dishCountOptions.map((d) => (
                <button
                  key={d}
                  onClick={() => { setConfig((c) => ({ ...c, dishCount: d })); setFieldErrors((fe) => ({ ...fe, dishCount: '' })); }}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 12, cursor: 'pointer',
                    borderRadius: 6, border: '1px solid var(--color-border)',
                    background: config.dishCount === d ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: config.dishCount === d ? 'white' : 'var(--color-text-muted)',
                  }}
                >{d}</button>
              ))}
            </div>
            {fieldErrors.dishCount && (
              <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.dishCount}</p>
            )}
          </div>

          {/* 荤素配比 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>荤素配比<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {meatVegOptions.map((m) => (
                <button
                  key={m}
                  onClick={() => { setConfig((c) => ({ ...c, meatVegRatio: m })); setFieldErrors((fe) => ({ ...fe, meatVegRatio: '' })); }}
                  style={{
                    padding: '5px 12px', fontSize: 12, cursor: 'pointer',
                    borderRadius: 999, border: '1px solid var(--color-border)',
                    background: config.meatVegRatio === m ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: config.meatVegRatio === m ? 'white' : 'var(--color-text-muted)',
                  }}
                >{m}</button>
              ))}
            </div>
            {fieldErrors.meatVegRatio && (
              <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.meatVegRatio}</p>
            )}
          </div>

          {/* 口味偏好 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>口味偏好<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
            <div style={{ display: 'flex', gap: 4 }}>
              {tasteOptions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => { setConfig((c) => ({ ...c, taste: t.value })); setFieldErrors((fe) => ({ ...fe, taste: '' })); }}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 13, cursor: 'pointer',
                    borderRadius: 6, border: '1px solid var(--color-border)',
                    background: config.taste === t.value ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: config.taste === t.value ? 'white' : 'var(--color-text-muted)',
                  }}
                >{t.label}</button>
              ))}
            </div>
            {fieldErrors.taste && (
              <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.taste}</p>
            )}
          </div>

          {/* 忌口 */}
          <div style={{ marginBottom: 16, position: 'relative' }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>忌口</label>
            {/* 标签输入框 */}
            <div
              style={{
                display: 'flex', flexWrap: 'wrap', gap: 4, padding: '6px 8px',
                borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', cursor: 'text',
                minHeight: 36,
              }}
              onClick={() => document.getElementById('restriction-input')?.focus()}
            >
              {/* 已选标签卡片 */}
              {config.restrictions.map((r) => (
                <span
                  key={r}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                    padding: '2px 8px', borderRadius: 999, fontSize: 12,
                    background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                  }}
                >
                  {r}
                  <span
                    style={{ cursor: 'pointer', fontWeight: 600, fontSize: 13, lineHeight: 1 }}
                    onClick={(e) => { e.stopPropagation(); removeRestriction(r); }}
                  >×</span>
                </span>
              ))}
              <input
                id="restriction-input"
                value={newRestriction}
                onChange={(e) => setNewRestriction(e.target.value)}
                onFocus={() => setRestrictionFocused(true)}
                onBlur={() => setTimeout(() => setRestrictionFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newRestriction.trim()) {
                    addRestriction(newRestriction.trim());
                  } else if (e.key === 'Backspace' && !newRestriction && config.restrictions.length > 0) {
                    removeRestriction(config.restrictions[config.restrictions.length - 1]);
                  }
                }}
                placeholder={config.restrictions.length === 0 ? '输入忌口，回车确认，如：香菜' : ''}
                maxLength={20}
                style={{
                  flex: 1, minWidth: 80, border: 'none', outline: 'none',
                  fontSize: 13, background: 'transparent', color: 'var(--color-text)',
                  fontFamily: 'inherit',
                }}
              />
            </div>
            {/* 下拉候选列表 */}
            {restrictionFocused && restrictionCandidates.length > 0 && (
              <div style={{
                position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 10,
                marginTop: 4, borderRadius: 6, border: '1px solid var(--color-border)',
                background: 'var(--color-surface)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                overflow: 'hidden',
              }}>
                {restrictionCandidates.map((r) => (
                  <div
                    key={r}
                    onMouseDown={(e) => { e.preventDefault(); addRestriction(r); }}
                    style={{
                      padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                      color: 'var(--color-text)', transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-muted)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >{r}</div>
                ))}
              </div>
            )}
          </div>

          {/* 食谱约束来源 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
              选菜来源
            </label>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[
                { value: 'all', label: '全部食谱' },
                { value: 'public', label: '公共食谱' },
                { value: 'mine', label: '我的食谱' },
                { value: 'favorite', label: '我的收藏' },
              ].map((s) => (
                <button
                  key={s.value}
                  onClick={() => setConfig((c) => ({ ...c, recipeSource: s.value }))}
                  style={{
                    flex: 1, padding: '6px 0', fontSize: 12, cursor: 'pointer',
                    borderRadius: 6, border: '1px solid var(--color-border)',
                    background: (config.recipeSource || 'all') === s.value ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: (config.recipeSource || 'all') === s.value ? 'white' : 'var(--color-text-muted)',
                  }}
                >{s.label}</button>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>
              生成的菜单将从所选范围内的食谱中挑选菜品
            </p>
          </div>

          {/* 健康目标 */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>健康目标（可选）</label>
            <input
              value={config.healthGoal}
              onChange={(e) => setConfig((c) => ({ ...c, healthGoal: e.target.value }))}
              placeholder="如：控糖、增肌、减脂"
              maxLength={30}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box' }}
            />
          </div>

          {/* 生成按钮 */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              width: '100%', marginTop: 20, padding: '10px 24px', fontSize: 15, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit', borderRadius: 'var(--radius-btn)',
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '生成中（可能需要 30~60 秒）...' : '生成'}
          </button>
        </div>

        {/* ===== 右侧结果区 ===== */}
        <div>
          {currentMenu ? (
            <>
              {/* 顶部工具栏 */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{displayMenuName}</span>
                  <span style={{ marginLeft: 8, fontSize: 12, padding: '2px 10px', borderRadius: 999, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
                    {formatDateShort(currentMenu.config.startDate)} 起 · {currentMenu.config.planDays} 天 · {currentMenu.config.peopleCount} 人
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                  {isDraft && (
                    <>
                      <button
                        onClick={handleCancel}
                        style={{
                          padding: '5px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 6, border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        取消
                      </button>
                      <button
                        onClick={handleGenerate}
                        disabled={loading}
                        style={{
                          padding: '5px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 6, border: '1px solid var(--color-primary-border)',
                          background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
                          opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {loading ? '生成中...' : '重新生成'}
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={loading}
                        style={{
                          padding: '5px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 6, border: '1px solid var(--color-primary-strong)',
                          background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                          color: 'white', opacity: loading ? 0.6 : 1, whiteSpace: 'nowrap',
                        }}
                      >
                        {loading ? '保存中...' : '保存'}
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleApplyToToday(currentMenu)}
                    style={{
                      padding: '5px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      borderRadius: 6, border: '1px solid var(--color-primary)',
                      color: 'var(--color-primary)', background: 'var(--color-primary-subtle)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    应用到今日
                  </button>
                  <button
                    onClick={() => handleGenerateList(currentMenu)}
                    disabled={listLoading}
                    style={{
                      padding: '5px 10px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                      borderRadius: 6, border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      opacity: listLoading ? 0.6 : 1, whiteSpace: 'nowrap',
                    }}
                  >
                    {listLoading ? '加载中...' : '查看采购清单'}
                  </button>
                  <div style={{ display: 'flex', gap: 3 }}>
                    {(['matrix', 'list'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setView(v)}
                        style={{
                          padding: '5px 10px', fontSize: 12, cursor: 'pointer',
                          borderRadius: 6, border: '1px solid var(--color-border)',
                          background: view === v ? 'var(--color-primary)' : 'var(--color-surface)',
                          color: view === v ? 'white' : 'var(--color-text-muted)',
                        }}
                      >
                        {v === 'matrix' ? '矩阵' : '列表'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 矩阵视图 */}
              {view === 'matrix' && (() => {
                // 所有日期的餐次并集（保留出现顺序），保证不同日期餐次数量/顺序不一致时对齐
                const mealTypes: string[] = [];
                for (const day of currentMenu.days) {
                  for (const meal of day.meals) {
                    if (!mealTypes.includes(meal.mealType)) mealTypes.push(meal.mealType);
                  }
                }
                return (
                  <div className="card" style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-muted)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>日期</th>
                          {mealTypes.map((mt) => (
                            <th key={mt} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 12, color: 'var(--color-text-muted)' }}>{mt}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {currentMenu.days.map((day) => {
                          const mealByType: Record<string, typeof day.meals[0]> = {};
                          day.meals.forEach((meal) => { mealByType[meal.mealType] = meal; });
                          return (
                            <tr key={day.date} style={{ borderTop: '1px solid var(--color-border)' }}>
                              <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap' }}>{formatDateShort(day.date)}</td>
                              {mealTypes.map((mt) => {
                                const meal = mealByType[mt];
                                return (
                                  <td key={mt} style={{ padding: 8 }}>
                                    {meal ? (
                                      <div style={{ padding: 8, borderRadius: 6, background: 'var(--color-muted)', minHeight: 50 }}>
                                        {meal.dishes.map((d) => (
                                          <div key={d.name} style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }} onClick={() => handleViewDish(d.name)}>{d.name}</div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div style={{ minHeight: 50 }} />
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}

              {/* 列表视图 */}
              {view === 'list' && (
                <div className="card" style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', padding: 20 }}>
                  {currentMenu.days.map((day) => (
                    <div key={day.date} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{formatDateShort(day.date)}</div>
                      {day.meals.map((meal) => (
                        <div key={meal.mealType} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 8 }}>
                          <span style={{ flexShrink: 0, fontSize: 12, padding: '2px 10px', borderRadius: 999, color: 'white', background: mealColors[meal.mealType]?.bg || 'var(--color-primary)' }}>
                            {meal.mealType}
                          </span>
                          <div style={{ fontSize: 13 }}>
                            {meal.dishes.map((d) => (
                              <span key={d.name} style={{ cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }} onClick={() => handleViewDish(d.name)}>{d.name} </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              )}

              {/* 历史菜单列表（已整合，分页展示） */}
              <div style={{ marginTop: 24 }}>
                <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>历史菜单</h3>
                <Pagination
                  items={menus}
                  keyOf={(m) => m.id}
                  emptyText="还没有历史菜单"
                  grid
                  gridMinWidth={240}
                  renderItem={(m) => (
                    <div
                      className="card"
                      onClick={() => { setCurrentMenu(m); setIsDraft(false); }}
                      style={{
                        padding: 16, borderRadius: 'var(--radius-card)',
                        border: currentMenu?.id === m.id ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{menuLabel(m)}</div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
                          {m.config.peopleCount} 人
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--color-muted)' }}>
                          {m.config.planDays} 天
                        </span>
                        <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--color-muted)' }}>
                          {m.config.mealsPerDay} 餐/天
                        </span>
                        {m.config.taste && (
                          <span style={{ padding: '2px 8px', borderRadius: 999, background: 'var(--color-muted)' }}>
                            {m.config.taste}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginBottom: 10 }}>
                        {formatDateShort(m.config.startDate)} 起
                      </div>
                      {/* 操作按钮 */}
                      <div style={{ display: 'flex', gap: 6 }} onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleApplyToToday(m)}
                          style={{
                            flex: 1, padding: '6px 0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            borderRadius: 6, border: '1px solid var(--color-primary)',
                            color: 'var(--color-primary)', background: 'var(--color-primary-subtle)',
                          }}
                        >
                          应用到今日
                        </button>
                        <button
                          onClick={() => { setCurrentMenu(m); handleGenerateList(m); }}
                          style={{
                            flex: 1, padding: '6px 0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            borderRadius: 6, border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                          }}
                        >
                          查看采购清单
                        </button>
                        <button
                          onClick={(e) => handleDeleteMenu(m, e)}
                          style={{
                            flexShrink: 0, padding: '6px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                            borderRadius: 6, border: '1px solid var(--color-danger-border)',
                            color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
                          }}
                          title="删除菜单"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  )}
                />
              </div>
            </>
          ) : (
            <div className="card" style={{ borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)', padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>还没有生成菜单</div>
              <div style={{ fontSize: 13 }}>在左侧配置参数，点击「生成」开始</div>
            </div>
          )}
        </div>
      </div>

      {/* 采购清单弹窗 */}
      {listModalOpen && (
        <IngredientListModal
          items={listItems}
          loading={listLoading}
          onClose={() => setListModalOpen(false)}
          onUpdate={handleUpdateListItems}
        />
      )}

      {/* 食谱详情弹窗 */}
      <RecipeModal
        recipe={recipeDetail}
        onClose={() => setRecipeDetail(null)}
      />
    </div>
  );
}
