// ===== 认证状态管理 =====
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { User } from '../types';
import { getMe, login as apiLogin } from '../api/auth';
import { getToken, setToken, clearToken } from '../api/http';

// 认证上下文类型
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证 Provider，管理登录态
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 应用启动时，尝试用已有 token 获取用户信息
  useEffect(() => {
    const init = async () => {
      const savedToken = getToken();
      if (savedToken) {
        setTokenState(savedToken);
        try {
          const me = await getMe();
          setUser(me);
        } catch {
          // token 已失效，清除
          clearToken();
          setTokenState(null);
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  // 登录
  const login = useCallback(async (username: string, password: string) => {
    const res = await apiLogin(username, password);
    setToken(res.token);
    setTokenState(res.token);
    setUser(res.user);
  }, []);

  // 退出登录
  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    setUser(null);
  }, []);

  // 刷新用户信息（邮箱绑定/解绑后）
  const refreshUser = useCallback(async () => {
    try {
      const me = await getMe();
      setUser(me);
    } catch {
      // token 失效则清除
      clearToken();
      setTokenState(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// 使用认证上下文的 Hook
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth 必须在 AuthProvider 内使用');
  }
  return ctx;
}