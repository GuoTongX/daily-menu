// ===== 总览页：真实统计看板 + 今日预览 + 常用搭配 =====
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStats } from '../api/stats';
import { getMenus } from '../api/menus';
import { getAppliedMenu } from '../api/settings';
import { searchRecipe } from '../api/recipes';
import Icon from '../components/ui/Icon';
import RecipeModal from '../components/ui/RecipeModal';
import { showToast } from '../components/ui/Toast';
import { MEAL_COLORS } from '../constants/meal';
import type { MenuPlan, Recipe } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ menus: 0, today: 0, ingredients: 0, recipes: 0 });
  // 已应用菜单今日安排（优先展示）
  const [appliedMeals, setAppliedMeals] = useState<{ mealType: string; dishes: { name: string; description: string; ingredients: string[] }[] }[] | null>(null);
  // 食谱详情弹窗
  const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  });

  // 加载统计和已应用菜单
  useEffect(() => {
    Promise.all([
      getStats().catch(() => null),
      getAppliedMenu().catch(() => null),
      getMenus().catch(() => null),
    ]).then(([s, applied, allMenus]) => {
      if (s) setStats(s);
      if (applied?.menuId && allMenus) {
        const menu = (allMenus as MenuPlan[]).find((m) => m.id === applied.menuId);
        if (menu) {
          const start = new Date(applied.startDate);
          const target = new Date(today);
          const diff = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          if (diff >= 0 && diff < (menu.config?.planDays || 0)) {
            const day = menu.days?.find((d) => d.date === today);
            if (day?.meals?.length) {
              setAppliedMeals(day.meals);
            }
          }
        }
      }
    });
  }, [today]);

  // 常用搭配模板
  const templates = [
    { title: '三口之家 7 天家常菜', desc: '3 人 · 7 天 · 3 餐/天', config: { peopleCount: 3, planDays: 7, mealsPerDay: 3, taste: '家常', dishCount: '三菜', meatVegRatio: '两荤一素' } },
    { title: '一人 5 天省时餐', desc: '1 人 · 5 天 · 3 餐/天', config: { peopleCount: 1, planDays: 5, mealsPerDay: 3, taste: '清淡', dishCount: '两菜', meatVegRatio: '一荤一素' } },
    { title: '减脂高蛋白 5 天餐', desc: '1 人 · 5 天 · 3 餐/天', config: { peopleCount: 1, planDays: 5, mealsPerDay: 3, taste: '清淡', dishCount: '三菜', meatVegRatio: '一荤一素', healthGoal: '减脂高蛋白' } },
  ];

  // 应用模板：跳转到菜单页并预填配置
  const applyTemplate = (config: Record<string, unknown>) => {
    navigate('/menus', { state: { initialConfig: config } });
  };

  // 点击菜品 → 查看食谱详情
  const handleViewDish = async (dishName: string) => {
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

  const statItems = [
    { label: '累计菜单', value: stats.menus, hint: '去生成一份菜单', icon: 'menu' as const, path: '/menus' },
    { label: '今日计划', value: stats.today, hint: '查看今日安排', icon: 'calendar' as const, path: '/today' },
    { label: '食谱收藏', value: stats.recipes, hint: '去添加食谱', icon: 'book' as const, path: '/recipes' },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>饮食工作台</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>把吃什么，变成一份可以执行的计划</p>
      </div>

      {/* 今日预览卡片 */}
      <div className="card" style={{
        marginBottom: 24, padding: 20, borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-primary-border)', background: 'var(--color-primary-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="calendar" size={18} color="var(--color-primary)" />
            <span style={{ fontSize: 15, fontWeight: 600 }}>今天吃什么</span>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{todayLabel}</span>
          </div>
          <button
            onClick={() => navigate('/today')}
            style={{
              padding: '6px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 'var(--radius-btn)',
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)',
            }}
          >
            去看今日
          </button>
        </div>

        {appliedMeals ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
            {appliedMeals.map((meal) => (
              <div key={meal.mealType} style={{ padding: 12, borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_COLORS[meal.mealType] || 'var(--color-primary)', display: 'inline-block' }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{meal.mealType}</span>
                </div>
                {meal.dishes.map((d, i) => (
                  <div key={i} onClick={() => handleViewDish(d.name)} style={{ fontSize: 13, marginBottom: 3, cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{d.name}</div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 16, fontSize: 13, color: 'var(--color-text-muted)' }}>
            今天还没有安排，去「今日」页规划一下，或从已有菜单选择
          </div>
        )}
      </div>

      {/* 统计卡片 */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>数据概览</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 16, marginBottom: 32 }}>
        {statItems.map((s) => (
          <div
            key={s.label}
            className="card"
            onClick={() => navigate(s.path)}
            style={{
              padding: 20, borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Icon name={s.icon} size={18} color="var(--color-primary)" />
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{s.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 2 }}>{s.hint}</div>
          </div>
        ))}
      </div>

      {/* 常用搭配（可预填配置） */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>常用搭配</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        {templates.map((t) => (
          <div
            key={t.title}
            onClick={() => applyTemplate(t.config)}
            className="card"
            style={{
              padding: 20, cursor: 'pointer', borderRadius: 'var(--radius-card)',
              border: '1px solid var(--color-border)',
              background: 'linear-gradient(135deg, var(--color-surface), var(--color-muted))',
              transition: 'all 0.2s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Icon name="sparkle" size={16} color="var(--color-primary)" />
              <span style={{ fontSize: 15, fontWeight: 600 }}>{t.title}</span>
            </div>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{t.desc}</div>
          </div>
        ))}
      </div>

      {/* 食谱详情弹窗 */}
      <RecipeModal
        recipe={recipeDetail}
        onClose={() => setRecipeDetail(null)}
      />
    </div>
  );
}
