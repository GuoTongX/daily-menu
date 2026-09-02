// ===== 食谱库页面：卡片网格 + 详情 + 新增 =====
import { useState, useEffect, useCallback } from 'react';
import { getRecipes, getRecipe, createRecipe, deleteRecipe, toggleFavorite, copyRecipe, exportRecipes, importRecipes } from '../api/recipes';
import Pagination from '../components/ui/Pagination';
import RecipeModal from '../components/ui/RecipeModal';
import { showToast } from '../components/ui/Toast';
import { CATEGORIES, TIME_OPTIONS, DIFFICULTIES, parseMinutes } from '../constants/recipe';
import type { Recipe } from '../types';

// 食材与步骤条数上限
const MAX_INGREDIENTS = 20;
const MAX_STEPS = 15;

// 新增表单的本地状态类型
interface NewRecipeForm {
  name: string;
  category: string;
  cookTime: string;
  difficulty: string;
  tips: string;
  // 食材：每项 { name 名称, amount 用量 }
  ingredients: { name: string; amount: string }[];
  // 做法步骤：字符串数组
  steps: string[];
}

// 空表单初始值
function emptyForm(): NewRecipeForm {
  return {
    name: '',
    category: '热炒荤菜',
    cookTime: '',
    difficulty: '普通',
    tips: '',
    ingredients: [{ name: '', amount: '' }],
    steps: [''],
  };
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newRecipe, setNewRecipe] = useState<NewRecipeForm>(emptyForm());
  const [filter, setFilter] = useState<'all' | 'public' | 'mine' | 'favorite'>('all');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterTime, setFilterTime] = useState('');
  const [filterDifficulty, setFilterDifficulty] = useState('');

  // 加载食谱列表（按来源筛选）
  const loadRecipes = useCallback(async () => {
    try {
      const list = await getRecipes(filter);
      setRecipes(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [filter]);

  useEffect(() => {
    loadRecipes();
  }, [loadRecipes]);

  // 新增食谱
  const handleAdd = async () => {
    if (!newRecipe.name.trim()) {
      setError('请填写食谱名称');
      return;
    }
    // 至少需要一个食材
    if (!newRecipe.ingredients.some((i) => i.name.trim())) {
      setError('请至少填写一个食材');
      return;
    }
    // 至少需要一个做法步骤
    if (!newRecipe.steps.some((s) => s.trim())) {
      setError('请至少填写一个做法步骤');
      return;
    }
    // 条数上限校验
    const validIngredients = newRecipe.ingredients.filter((i) => i.name.trim());
    if (validIngredients.length > MAX_INGREDIENTS) {
      setError(`食材最多 ${MAX_INGREDIENTS} 条`);
      return;
    }
    const validSteps = newRecipe.steps.map((s) => s.trim()).filter((s) => s.length > 0);
    if (validSteps.length > MAX_STEPS) {
      setError(`做法步骤最多 ${MAX_STEPS} 条`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      // 过滤空的食材和步骤
      const ingredients = validIngredients
        .map((i) => (i.amount.trim() ? `${i.name.trim()} ${i.amount.trim()}` : i.name.trim()));
      const steps = validSteps;

      const res = await createRecipe({
        name: newRecipe.name.trim(),
        category: newRecipe.category,
        cookTime: newRecipe.cookTime.trim(),
        difficulty: newRecipe.difficulty,
        tips: newRecipe.tips.trim(),
        ingredients,
        steps,
      });
      setShowAdd(false);
      setNewRecipe(emptyForm());
      // 新项重新加载列表，保持访问最新数据
      setSelected(res);
      await loadRecipes();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // 删除食谱
  const handleDelete = async (id: number) => {
    if (!confirm('确定删除该食谱吗？')) return;
    setError('');
    try {
      await deleteRecipe(id);
      setSelected(null);
      await loadRecipes();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  // 切换收藏（个人食谱的收藏标记）
  const handleToggleFavorite = async (id: number) => {
    try {
      const res = await toggleFavorite(id);
      setRecipes((list) => list.map((r) => (r.id === id ? { ...r, favorite: res.favorite } : r)));
      setSelected((s) => (s && s.id === id ? { ...s, favorite: res.favorite } : s));
      showToast(res.favorite ? '已收藏' : '已取消收藏', 'success');
    } catch (e) {
      showToast((e as Error).message, 'error');
    }
  };

  // 收藏复制（公共食谱 → 我的食谱）
  const handleCopyRecipe = async (id: number) => {
    try {
      await copyRecipe(id);
      await loadRecipes();
      showToast('收藏成功，该食谱已添加到我的食谱', 'success');
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes('已收藏')) {
        showToast('该食谱已在你的收藏中', 'info');
      } else {
        showToast(msg || '收藏失败', 'error');
      }
    }
  };

  // 导出个人食谱
  const handleExport = async () => {
    try {
      const data = await exportRecipes();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `recipes-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('导出成功', 'success');
    } catch (e) {
      showToast('导出失败: ' + (e as Error).message, 'error');
    }
  };

  // 导入个人食谱
  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const recipes = data.recipes || (Array.isArray(data) ? data : [data]);
        if (!Array.isArray(recipes) || recipes.length === 0) {
          showToast('文件格式无效，请选择导出的 JSON 文件', 'error');
          return;
        }
        const result = await importRecipes(recipes);
        await loadRecipes();
        showToast(`成功导入 ${result.imported} 条食谱`, 'success');
      } catch (e) {
        showToast('导入失败: ' + ((e as Error).message || '文件格式错误'), 'error');
      }
    };
    input.click();
  };

  // 更新食材项
  const updateIngredient = (idx: number, field: 'name' | 'amount', value: string) => {
    setNewRecipe((f) => {
      const ingredients = f.ingredients.map((it, i) => (i === idx ? { ...it, [field]: value } : it));
      return { ...f, ingredients };
    });
  };

  // 增加食材行
  const addIngredient = () => {
    setNewRecipe((f) => ({ ...f, ingredients: [...f.ingredients, { name: '', amount: '' }] }));
  };

  // 删除食材行
  const removeIngredient = (idx: number) => {
    setNewRecipe((f) => ({ ...f, ingredients: f.ingredients.filter((_, i) => i !== idx) }));
  };

  // 更新步骤
  const updateStep = (idx: number, value: string) => {
    setNewRecipe((f) => ({ ...f, steps: f.steps.map((s, i) => (i === idx ? value : s)) }));
  };

  // 增加步骤
  const addStep = () => {
    setNewRecipe((f) => ({ ...f, steps: [...f.steps, ''] }));
  };

  // 删除步骤
  const removeStep = (idx: number) => {
    setNewRecipe((f) => ({ ...f, steps: f.steps.filter((_, i) => i !== idx) }));
  };

  // 本地过滤：搜索 + 来源（后端已处理） + 分类 + 时间 + 难度
  const filtered = recipes.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterTime) {
      const minutes = parseMinutes(r.cookTime);
      const opt = TIME_OPTIONS.find((o) => o.label === filterTime);
      if (opt && !opt.test(minutes)) return false;
    }
    if (filterDifficulty && r.difficulty !== filterDifficulty) return false;
    return true;
  });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>食谱库</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>记录食材用量、做法步骤和小贴士，支持搜索与新增。</p>
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

      {/* 工具栏 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索食谱..."
          maxLength={30}
          style={{ maxWidth: 300, width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)' }}
        />
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'public', 'mine', 'favorite'] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setError(''); }}
              style={{
                padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: '1px solid var(--color-border)',
                background: filter === f ? 'var(--color-primary)' : 'var(--color-surface)',
                color: filter === f ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {f === 'all' ? '全部' : f === 'public' ? '公共食谱' : f === 'mine' ? '我的食谱' : '我的收藏'}
            </button>
          ))}
        </div>
        <button
          onClick={handleExport}
          style={{
            padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 6, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-muted)',
          }}
          title="导出个人食谱为 JSON"
        >
          导出
        </button>
        <button
          onClick={handleImport}
          style={{
            padding: '8px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 6, border: '1px solid var(--color-border)',
            background: 'var(--color-surface)', color: 'var(--color-text-muted)',
          }}
          title="从 JSON 文件导入食谱"
        >
          导入
        </button>
        <button
          onClick={() => { setShowAdd(!showAdd); setError(''); }}
          style={{
            padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
            borderRadius: 'var(--radius-btn)',
            background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
            color: 'white', border: '1px solid var(--color-primary-strong)',
          }}
        >
          {showAdd ? '取消' : '新增食谱'}
        </button>
      </div>

      {/* 筛选行：分类 | 烹饪时间 | 难度 */}
      <div style={{ marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 分类 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', minWidth: 40, flexShrink: 0 }}>分类</span>
          {['全部', ...CATEGORIES].map((c) => (
            <button
              key={c}
              onClick={() => setFilterCategory(c === '全部' ? '' : c)}
              style={{
                padding: '3px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 999, border: '1px solid var(--color-border)',
                background: (c === '全部' ? !filterCategory : filterCategory === c) ? 'var(--color-primary)' : 'var(--color-surface)',
                color: (c === '全部' ? !filterCategory : filterCategory === c) ? 'white' : 'var(--color-text-muted)',
                transition: 'all 0.15s',
              }}
            >{c === '全部' ? '全部' : c}</button>
          ))}
        </div>
        {/* 烹饪时间 */}
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
        {/* 难度 */}
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

      {/* 新增表单 */}
      {showAdd && (
        <div className="card" style={{ padding: 20, marginBottom: 20, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>新增食谱</h3>

          {/* 基本信息 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>名称 *</label>
              <input
                value={newRecipe.name}
                onChange={(e) => setNewRecipe({ ...newRecipe, name: e.target.value })}
                placeholder="菜名"
                maxLength={30}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>分类</label>
              <select
                value={newRecipe.category}
                onChange={(e) => setNewRecipe({ ...newRecipe, category: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)' }}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>烹饪时间</label>
              <input
                value={newRecipe.cookTime}
                onChange={(e) => setNewRecipe({ ...newRecipe, cookTime: e.target.value })}
                placeholder="如：30分钟"
                maxLength={20}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>难度</label>
              <select
                value={newRecipe.difficulty}
                onChange={(e) => setNewRecipe({ ...newRecipe, difficulty: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, background: 'var(--color-surface)' }}
              >
                {['简单', '普通', '困难'].map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 食材（含用量） */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>食材与用量</label>
              {newRecipe.ingredients.length < MAX_INGREDIENTS && (
                <button
                  onClick={addIngredient}
                  style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                >
                  + 添加食材
                </button>
              )}
            </div>
            {newRecipe.ingredients.map((ing, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input
                  value={ing.name}
                  onChange={(e) => updateIngredient(idx, 'name', e.target.value)}
                  placeholder="食材名称，如：五花肉"
                  maxLength={30}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}
                />
                <input
                  value={ing.amount}
                  onChange={(e) => updateIngredient(idx, 'amount', e.target.value)}
                  placeholder="用量，如：300g"
                  maxLength={20}
                  style={{ width: 160, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13 }}
                />
                {newRecipe.ingredients.length > 1 && (
                  <button
                    onClick={() => removeIngredient(idx)}
                    title="删除"
                    style={{ padding: '6px 10px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}
                  >×</button>
                )}
              </div>
            ))}
            <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', margin: 0 }}>用量可留空，如「葱 适量」「盐 少许」</p>
          </div>

          {/* 做法步骤 */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)' }}>做法步骤</label>
              {newRecipe.steps.length < MAX_STEPS && (
                <button
                  onClick={addStep}
                  style={{ padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}
                >
                  + 添加步骤
                </button>
              )}
            </div>
            {newRecipe.steps.map((step, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
                <span style={{ width: 24, height: 24, flexShrink: 0, borderRadius: '50%', background: 'var(--color-primary-subtle)', color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, marginTop: 8 }}>
                  {idx + 1}
                </span>
                <textarea
                  value={step}
                  onChange={(e) => updateStep(idx, e.target.value)}
                  placeholder={`第 ${idx + 1} 步...`}
                  rows={2}
                  maxLength={300}
                  style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }}
                />
                {newRecipe.steps.length > 1 && (
                  <button
                    onClick={() => removeStep(idx)}
                    title="删除"
                    style={{ padding: '6px 10px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)', background: 'var(--color-danger-bg)', marginTop: 6 }}
                  >×</button>
                )}
              </div>
            ))}
          </div>

          {/* 小贴士 */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', display: 'block', marginBottom: 8 }}>小贴士（可选）</label>
            <textarea
              value={newRecipe.tips}
              onChange={(e) => setNewRecipe({ ...newRecipe, tips: e.target.value })}
              placeholder="如：腌制时加少许料酒可去腥"
              rows={2}
              maxLength={300}
              style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={handleAdd}
            disabled={loading || !newRecipe.name.trim()}
            style={{
              padding: '8px 20px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6,
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '保存中...' : '保存食谱'}
          </button>
        </div>
      )}

      {/* 食谱卡片网格（带分页） */}
      <Pagination
        items={filtered}
        keyOf={(r) => r.id}
        emptyText={search ? '未找到匹配的食谱' : '还没有收藏的食谱'}
        grid
        gridMinWidth={260}
        renderItem={(r) => (
          <div
            onClick={async () => { try { const full = await getRecipe(r.id); setSelected(full); } catch { setSelected(r); } }}
            className="card"
            style={{
              padding: 16, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)',
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 600, flex: 1, minWidth: 0 }}>{r.name}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                {/* 收藏：公共食谱用"收藏复制"，个人食谱切换收藏状态；统一文字按钮样式 */}
                {r.isPublic ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); if (!r.isCollected) handleCopyRecipe(r.id); }}
                    disabled={r.isCollected}
                    style={{ fontSize: 12, padding: '3px 8px', cursor: r.isCollected ? 'default' : 'pointer', fontFamily: 'inherit', borderRadius: 6, border: r.isCollected ? '1px solid var(--color-border)' : '1px solid var(--color-primary)', color: r.isCollected ? 'var(--color-text-muted)' : 'var(--color-primary)', background: r.isCollected ? 'var(--color-muted)' : 'var(--color-primary-subtle)', opacity: r.isCollected ? 0.7 : 1 }}
                    title={r.isCollected ? '已收藏到我的食谱' : '收藏到我的食谱'}
                  >
                    {r.isCollected ? '已收藏' : '收藏'}
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleToggleFavorite(r.id); }}
                    style={{ fontSize: 12, padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6, border: r.favorite ? '1px solid var(--color-primary)' : '1px solid var(--color-border)', color: r.favorite ? '#f59e0b' : 'var(--color-text-muted)', background: r.favorite ? 'var(--color-primary-subtle)' : 'var(--color-surface)', transition: 'all 0.15s' }}
                    title={r.favorite ? '取消收藏' : '收藏'}
                  >
                    {r.favorite ? '★ 已收藏' : '☆ 收藏'}
                  </button>
                )}
                <span
                  style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: r.isPublic ? '#fef3c7' : 'var(--color-primary-subtle)', color: r.isPublic ? '#92400e' : 'var(--color-primary)' }}
                >
                  {r.isPublic ? '公共' : '个人'}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 999, background: 'var(--color-primary-subtle)', color: 'var(--color-primary)' }}>
                  {r.difficulty}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--color-text-muted)' }}>
              <span>{r.cookTime || '时长未知'}</span>
              <span>|</span>
              <span>{r.category}</span>
            </div>
          </div>
        )}
      />

      {/* 食谱详情弹窗 */}
      <RecipeModal
        recipe={selected}
        onClose={() => setSelected(null)}
        onCopy={handleCopyRecipe}
        onToggleFavorite={handleToggleFavorite}
        onDelete={handleDelete}
      />
    </div>
  );
}
