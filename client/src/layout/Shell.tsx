// ===== 主布局组件：侧边栏 + 内容区 =====
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon, { type IconName } from '../components/ui/Icon';
import Toast from '../components/ui/Toast';

// 导航项定义（图标映射到 Icon 组件的名称）
const navItems: { path: string; label: string; icon: IconName }[] = [
  { path: '/', label: '总览', icon: 'dashboard' },
  { path: '/today', label: '今日', icon: 'calendar' },
  { path: '/menus', label: '菜单', icon: 'menu' },
  { path: '/recipes', label: '食谱', icon: 'book' },
  { path: '/shopping', label: '采购清单', icon: 'shopping' },
  { path: '/settings/model', label: '模型设置', icon: 'bot' },
  { path: '/account', label: '账户', icon: 'user' },
];

export default function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // 判断当前页面是否激活
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-shell" style={{ display: 'flex', minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <aside
        className="sidebar"
        style={{
          width: 220,
          background: 'var(--color-surface)',
          borderRight: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          zIndex: 50,
        }}
      >
        {/* Logo 区域 */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 16, fontWeight: 700,
          }}>食</div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)' }}>每日食方</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>智能食谱规划</div>
          </div>
        </div>

        {/* 导航菜单 */}
        <nav style={{ flex: 1, padding: '12px 10px', overflowY: 'auto' }}>
          {navItems.map((item) => (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 6,
                cursor: 'pointer', color: isActive(item.path) ? 'var(--color-primary)' : 'var(--color-text-muted)',
                background: isActive(item.path) ? 'var(--color-primary-subtle)' : 'transparent',
                fontWeight: isActive(item.path) ? 600 : 500,
                fontSize: 14, marginBottom: 2, transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.background = 'var(--color-muted)';
                  e.currentTarget.style.color = 'var(--color-text)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive(item.path)) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--color-text-muted)';
                }
              }}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </div>
          ))}
        </nav>

        {/* 底部用户信息 */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'var(--color-primary)',
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600,
            }}>
              {user?.username?.charAt(0) || '?'}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{user?.username || '未登录'}</div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>已登录</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 主内容区 */}
      <main style={{ flex: 1, marginLeft: 220, padding: '32px 40px', maxWidth: 1200 }}>
        <Outlet />
      </main>

      {/* 全局 Toast 提示 */}
      <Toast />
    </div>
  );
}