// ===== 应用根组件：路由配置 =====
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Shell from './layout/Shell';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Today from './pages/Today';
import Menus from './pages/Menus';
import Recipes from './pages/Recipes';
import ShoppingList from './pages/ShoppingList';
import ModelSettings from './pages/ModelSettings';
import Account from './pages/Account';

// 受保护路由：未登录则跳转到登录页
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--color-text-muted)' }}>
        加载中...
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  const { user, loading } = useAuth();

  // 如果已登录，默认跳转到总览
  if (!loading && user && window.location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="today" element={<Today />} />
        <Route path="menus" element={<Menus />} />
        <Route path="recipes" element={<Recipes />} />
        <Route path="shopping" element={<ShoppingList />} />
        <Route path="settings/model" element={<ModelSettings />} />
        <Route path="account" element={<Account />} />
      </Route>
    </Routes>
  );
}