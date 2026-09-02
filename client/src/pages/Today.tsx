// ===== 今日页面：看今天吃什么 =====
// 主内容区：第一优先级已应用菜单 > 第二优先级今日计划 > 空态引导
// 辅助操作区：随机推荐折叠在详情中
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { randomDish } from '../api/today';
import { getMenus } from '../api/menus';
import { getAppliedMenu, saveAppliedMenu } from '../api/settings';
import { searchRecipe } from '../api/recipes';
import Icon from '../components/ui/Icon';
import RecipeModal from '../components/ui/RecipeModal';
import { showToast } from '../components/ui/Toast';
import { MEAL_COLORS } from '../constants/meal';
import { formatDateShort } from '../utils/date';
import type { MenuPlan, Dish, Recipe } from '../types';

// 检查某天是否在菜单覆盖范围内
function isDateInMenuRange(startDate: string, planDays: number, targetDate: string): boolean {
  const start = new Date(startDate);
  const target = new Date(targetDate);
  const diff = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return diff >= 0 && diff < planDays;
}

// 从菜单中提取某天的餐单
function getMealsForDate(menu: MenuPlan, targetDate: string) {
  return menu.days.find((d) => d.date === targetDate)?.meals || [];
}

// localStorage key（兼容旧数据，新数据同时写入 DB 和 localStorage）
const APPLIED_MENU_KEY = 'dm_applied_menu';

export default function Today() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [menus, setMenus] = useState<MenuPlan[]>([]);
  const [selectedMenuId, setSelectedMenuId] = useState<number | null>(null);
  const [selectedMenu, setSelectedMenu] = useState<MenuPlan | null>(null);
  const [menuStartDate, setMenuStartDate] = useState('');
  const [menuMealsForToday, setMenuMealsForToday] = useState<{ date: string; meals: { mealType: string; dishes: Dish[] }[] }[]>([]);
  const [showMenuSelector, setShowMenuSelector] = useState(false);

  // 已应用的菜单（固化展示）
  const [appliedMenu, setAppliedMenu] = useState<{
    menuName: string;
    startDate: string;
    planDays: number;
    mealsToday: { mealType: string; dishes: Dish[] }[];
    mealsTomorrow: { mealType: string; dishes: Dish[] }[];
  } | null>(null);

  // 随机推荐相关
  const [randomDishResult, setRandomDishResult] = useState<Dish & { reason: string } | null>(null);
  const [randomLoading, setRandomLoading] = useState(false);
  const [randomTaste, setRandomTaste] = useState('清淡');
  const [randomMealType, setRandomMealType] = useState('午餐');
  // 随机推荐食谱详情（在食谱库中搜索到的完整信息）
  const [recipeDetail, setRecipeDetail] = useState<Recipe | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const tomorrowLabel = new Date(Date.now() + 86400000).toLocaleDateString('zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  });

  // 加载历史菜单
  const loadMenus = useCallback(async () => {
    try {
      const list = await getMenus();
      setMenus(list);
    } catch {
      // 忽略
    }
  }, []);

  // 恢复已应用的菜单：优先从 DB 读取（跨浏览器一致），localStorage 仅作旧数据回退
  useEffect(() => {
    if (menus.length === 0) return;
    const restore = (data: { menuId: number; startDate: string } | null) => {
      if (!data) return;
      const menu = menus.find((m) => m.id === data.menuId);
      if (menu) {
        computeAndApply(menu, data.startDate, true);
      }
    };
    // 从 DB 读取（用户绑定，换浏览器不丢失）
    getAppliedMenu()
      .then((data) => {
        if (data?.menuId) {
          restore(data);
        } else {
          // DB 无记录时回退到 localStorage（兼容旧数据），并同步到 DB
          try {
            const saved = localStorage.getItem(APPLIED_MENU_KEY);
            if (saved) {
              const local = JSON.parse(saved);
              if (local?.menuId) {
                restore(local);
                saveAppliedMenu(local.menuId, local.startDate || '').catch(() => {});
              }
            }
          } catch {
            // ignore
          }
        }
      })
      .catch(() => {
        // DB 读取失败时回退到 localStorage
        try {
          const saved = localStorage.getItem(APPLIED_MENU_KEY);
          if (saved) restore(JSON.parse(saved));
        } catch {
          // ignore
        }
      });
  }, [menus, today, tomorrow]);

  useEffect(() => {
    loadMenus();
  }, [loadMenus]);

  // 选中菜单时计算覆盖日期
  const handleSelectMenu = (menuId: number) => {
    setSelectedMenuId(menuId);
    const menu = menus.find((m) => m.id === menuId) || null;
    setSelectedMenu(menu);
    if (menu) {
      setMenuStartDate(menu.config.startDate);
      computeMenuMeals(menu, menu.config.startDate);
    }
  };

  // 当菜单生效日期改变时重新计算
  const handleMenuStartDateChange = (date: string) => {
    setMenuStartDate(date);
    if (selectedMenu) {
      computeMenuMeals(selectedMenu, date);
    }
  };

  // 计算菜单覆盖的日期的餐单
  const computeMenuMeals = (menu: MenuPlan, startDate: string) => {
    const results: { date: string; meals: { mealType: string; dishes: Dish[] }[] }[] = [];
    if (isDateInMenuRange(startDate, menu.config.planDays, today)) {
      const todayMeals = getMealsForDate(menu, today);
      if (todayMeals.length > 0) {
        results.push({ date: today, meals: todayMeals });
      }
    }
    if (isDateInMenuRange(startDate, menu.config.planDays, tomorrow)) {
      const tomorrowMeals = getMealsForDate(menu, tomorrow);
      if (tomorrowMeals.length > 0) {
        results.push({ date: tomorrow, meals: tomorrowMeals });
      }
    }
    setMenuMealsForToday(results);
  };

  // 计算并应用菜单
  const computeAndApply = (menu: MenuPlan, startDate: string, restore = false) => {
    const todayMeals = isDateInMenuRange(startDate, menu.config.planDays, today)
      ? getMealsForDate(menu, today) : [];
    const tomorrowMeals = isDateInMenuRange(startDate, menu.config.planDays, tomorrow)
      ? getMealsForDate(menu, tomorrow) : [];
    const applied = {
      menuName: menu.name || `${formatDateShort(menu.config.startDate)} 起`,
      startDate,
      planDays: menu.config.planDays,
      mealsToday: todayMeals,
      mealsTomorrow: tomorrowMeals,
    };
    setAppliedMenu(applied);
    if (!restore) {
      const data = { menuId: menu.id, startDate };
      // 同时写入 DB（用户绑定）与 localStorage（兼容/离线回退）
      localStorage.setItem(APPLIED_MENU_KEY, JSON.stringify(data));
      saveAppliedMenu(menu.id, startDate).catch(() => {});
      setShowMenuSelector(false);
    }
  };

  // 应用按钮
  const handleApply = () => {
    if (!selectedMenu) return;
    computeAndApply(selectedMenu, menuStartDate, false);
  };

  // 取消应用
  const handleClearApplied = () => {
    setAppliedMenu(null);
    localStorage.removeItem(APPLIED_MENU_KEY);
    saveAppliedMenu(null, '').catch(() => {});
  };

  // 随机推荐
  const handleRandomDish = async () => {
    setRandomLoading(true);
    setError('');
    setRandomDishResult(null);
    setRecipeDetail(null);
    try {
      const result = await randomDish({ mealType: randomMealType, taste: randomTaste });
      setRandomDishResult(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRandomLoading(false);
    }
  };

  // 查看菜品食谱详情（在食谱库中按名称搜索）
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

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>今天吃什么</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>{todayLabel}</p>
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

      {/* ===== 主内容区：第一优先级 已应用菜单 > 第二优先级 今日计划 > 空态 ===== */}

      {/* 已应用的菜单固化展示 */}
      {appliedMenu && (
        <div className="card" style={{
          padding: 20, marginBottom: 24, borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-primary-border)',
          background: 'var(--color-primary-subtle)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              已应用菜单：{appliedMenu.menuName}
              <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                {formatDateShort(appliedMenu.startDate)} 起 · {appliedMenu.planDays} 天
              </span>
            </h3>
            <button
              onClick={handleClearApplied}
              style={{
                padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 6, border: '1px solid var(--color-danger-border)',
                color: 'var(--color-danger)', background: 'var(--color-danger-bg)',
              }}
            >
              取消应用
            </button>
          </div>

          {/* 今日安排 */}
          {appliedMenu.mealsToday.length > 0 ? (
            <div style={{ marginBottom: 16 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
                今日安排
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>{todayLabel}</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                {appliedMenu.mealsToday.map((meal) => (
                  <div key={meal.mealType} style={{
                    padding: 16, borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_COLORS[meal.mealType] || 'var(--color-primary)', display: 'inline-block' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{meal.mealType}</span>
                    </div>
                    {meal.dishes.map((dish) => (
                      <div key={dish.name} onClick={() => handleViewDish(dish.name)} style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{dish.name}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              padding: 16, marginBottom: 16, textAlign: 'center', color: 'var(--color-text-muted)',
              background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)',
            }}>
              该菜单今日无安排，请调整生效日期
            </div>
          )}

          {/* 明日安排 */}
          {appliedMenu.mealsTomorrow.length > 0 && (
            <div>
              <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
                明日安排
                <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>{tomorrowLabel}</span>
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                {appliedMenu.mealsTomorrow.map((meal) => (
                  <div key={meal.mealType} style={{
                    padding: 16, borderRadius: 'var(--radius-card)',
                    border: '1px solid var(--color-border)', background: 'var(--color-surface)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_COLORS[meal.mealType] || 'var(--color-primary)', display: 'inline-block' }} />
                      <span style={{ fontSize: 14, fontWeight: 600 }}>{meal.mealType}</span>
                    </div>
                    {meal.dishes.map((dish) => (
                      <div key={dish.name} onClick={() => handleViewDish(dish.name)} style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{dish.name}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 空态（无已应用菜单时展示） */}
      {!appliedMenu && (
        <div className="card" style={{
          borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)',
          padding: 40, textAlign: 'center', color: 'var(--color-text-muted)',
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
            还没有今日安排
          </div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            从已有菜单选择今日吃什么，或去菜单工作台生成一份完整的饮食计划。
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowMenuSelector(!showMenuSelector)}
              style={{
                padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-btn)',
                background: 'var(--color-surface)', border: '1px solid var(--color-border)',
                color: 'var(--color-text)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name="calendar" size={16} /> 从已有菜单选择
            </button>
            <button
              onClick={() => navigate('/menus')}
              style={{
                padding: '10px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-btn)',
                background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                color: 'white', border: '1px solid var(--color-primary-strong)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <Icon name="menu" size={16} /> 去菜单工作台生成
            </button>
          </div>
        </div>
      )}

      {/* ===== 辅助操作区 ===== */}

      {/* 从已有菜单选择区域 */}
      {showMenuSelector && (
        <div className="card" style={{
          padding: 20, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-primary-border)',
          marginBottom: 24, background: 'var(--color-primary-subtle)',
        }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>从已有菜单选择</h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>
                选择菜单
              </label>
              <select
                value={selectedMenuId ?? ''}
                onChange={(e) => handleSelectMenu(Number(e.target.value))}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 14, background: 'var(--color-surface)' }}
              >
                <option value="">请选择...</option>
                {menus.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || `${formatDateShort(m.config.startDate)} 起`}（{m.config.planDays} 天）
                  </option>
                ))}
              </select>
            </div>

            {selectedMenu && (
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>
                  生效日期（菜单开始时间）
                </label>
                <input
                  type="date"
                  value={menuStartDate}
                  onChange={(e) => handleMenuStartDateChange(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid var(--color-border)', fontSize: 14, background: 'var(--color-surface)', boxSizing: 'border-box' }}
                />
                <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>
                  结束日期：{formatDateShort(new Date(new Date(menuStartDate).getTime() + (selectedMenu.config.planDays - 1) * 86400000).toISOString().slice(0, 10))}（共 {selectedMenu.config.planDays} 天）
                </p>
              </div>
            )}
          </div>

          {/* 显示今天/明天的餐单 */}
          {selectedMenu && (
            <div style={{ marginBottom: 16 }}>
              {menuMealsForToday.length === 0 ? (
                <div style={{ padding: 16, textAlign: 'center', color: 'var(--color-text-muted)', background: 'var(--color-surface)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>所选菜单未覆盖今日</div>
                  <div style={{ fontSize: 13 }}>
                    该菜单从 {formatDateShort(menuStartDate)} 开始，持续 {selectedMenu.config.planDays} 天，不包含今天的日期，请调整生效日期。
                  </div>
                </div>
              ) : (
                menuMealsForToday.map((item) => (
                  <div key={item.date} style={{ marginBottom: 12 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: 'var(--color-text)' }}>
                      {item.date === today ? '今日安排' : '明日安排'}
                      <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 400, color: 'var(--color-text-muted)' }}>
                        {item.date === today ? todayLabel : tomorrowLabel}
                      </span>
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
                      {item.meals.map((meal) => (
                        <div key={meal.mealType} className="card" style={{
                          padding: 16, borderRadius: 'var(--radius-card)',
                          border: '1px solid var(--color-border)',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: MEAL_COLORS[meal.mealType] || 'var(--color-primary)', display: 'inline-block' }} />
                            <span style={{ fontSize: 14, fontWeight: 600 }}>{meal.mealType}</span>
                          </div>
                          {meal.dishes.map((dish) => (
                            <div key={dish.name} onClick={() => handleViewDish(dish.name)} style={{ fontSize: 13, fontWeight: 500, marginBottom: 2, cursor: 'pointer', color: 'var(--color-primary)', textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>{dish.name}</div>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!selectedMenu && (
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', textAlign: 'center', padding: 16 }}>
              请先选择一份已有菜单，然后选择生效日期。
            </p>
          )}

          {/* 应用按钮 */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={() => setShowMenuSelector(false)}
              style={{
                padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)',
                background: 'var(--color-surface)',
              }}
            >
              取消
            </button>
            <button
              onClick={handleApply}
              disabled={!selectedMenu}
              style={{
                padding: '8px 18px', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-btn)',
                background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                color: 'white', border: '1px solid var(--color-primary-strong)',
                opacity: selectedMenu ? 1 : 0.5,
              }}
            >
              应用
            </button>
          </div>
        </div>
      )}

      {/* 随机推荐 + 选项（辅助功能，折叠在详情中，不喧宾夺主） */}
      <details style={{ marginBottom: 24 }}>
        <summary style={{
          cursor: 'pointer', fontSize: 14, fontWeight: 500, color: 'var(--color-text-muted)',
          padding: '10px 0', outline: 'none',
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="dice" size={14} /> 没想好吃什么？让 AI 替你选一道
          </span>
        </summary>
        <div className="card" style={{
          padding: 20, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)',
        }}>
          {/* 随机推荐选项 */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>餐次</label>
              <div style={{ display: 'flex', gap: 2 }}>
                {['早餐', '午餐', '晚餐', '加餐'].map((m) => (
                  <button
                    key={m}
                    onClick={() => setRandomMealType(m)}
                    style={{
                      padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6,
                      border: '1px solid var(--color-border)', fontFamily: 'inherit',
                      background: randomMealType === m ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: randomMealType === m ? 'white' : 'var(--color-text-muted)',
                    }}
                  >{m}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>口味</label>
              <div style={{ display: 'flex', gap: 2 }}>
                {['清淡', '家常', '鲜美', '浓郁'].map((t) => (
                  <button
                    key={t}
                    onClick={() => setRandomTaste(t)}
                    style={{
                      padding: '5px 12px', fontSize: 13, cursor: 'pointer', borderRadius: 6,
                      border: '1px solid var(--color-border)', fontFamily: 'inherit',
                      background: randomTaste === t ? 'var(--color-primary)' : 'var(--color-surface)',
                      color: randomTaste === t ? 'white' : 'var(--color-text-muted)',
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>
            <button
              onClick={handleRandomDish}
              disabled={randomLoading}
              style={{
                padding: '8px 18px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                borderRadius: 'var(--radius-btn)', lineHeight: '1.4',
                background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                color: 'white', border: '1px solid var(--color-primary-strong)',
                opacity: randomLoading ? 0.6 : 1,
              }}
            >
              {randomLoading ? '推荐中...' : '随机推荐'}
            </button>
          </div>

          {/* 随机推荐结果 */}
          {randomDishResult && (
            <div style={{
              padding: 16, borderRadius: 8, border: '1px solid var(--color-primary-border)',
              background: 'var(--color-primary-subtle)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <Icon name="dice" size={24} color="var(--color-primary)" />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-text)' }}>{randomDishResult.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{randomDishResult.description}</div>
                </div>
              </div>
              {randomDishResult.ingredients && randomDishResult.ingredients.length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                  {randomDishResult.ingredients.map((ing) => (
                    <span key={ing} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 999, background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                      {ing}
                    </span>
                  ))}
                </div>
              )}
              {randomDishResult.reason && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--color-primary)', fontWeight: 500, marginBottom: 8 }}>
                  <Icon name="sparkle" size={14} />
                  {randomDishResult.reason}
                </div>
              )}
              <button
                onClick={() => handleViewDish(randomDishResult.name)}
                style={{
                  padding: '6px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
                  borderRadius: 6, border: '1px solid var(--color-primary)',
                  color: 'var(--color-primary)', background: 'var(--color-surface)',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
              >
                <Icon name="book" size={14} /> 查看食谱详情
              </button>
            </div>
          )}
        </div>
      </details>

      {/* 食谱详情弹窗 */}
      <RecipeModal
        recipe={recipeDetail}
        onClose={() => setRecipeDetail(null)}
      />
    </div>
  );
}