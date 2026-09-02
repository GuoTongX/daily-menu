// ===== HTTP 请求封装：统一处理 token 与错误 =====

const TOKEN_KEY = 'dm_token';

// 获取 token
export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// 保存 token
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

// 清除 token
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// 基础请求函数，自动附带 Authorization 头
export async function request<T>(
  url: string,
  options: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (auth) {
    const token = getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  const res = await fetch(url, { ...options, headers });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    // 统一抛出后端返回的错误信息
    const message = (data as { detail?: string }).detail || '请求失败';
    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  return data as T;
}

// GET 请求
export function get<T>(url: string, auth = true): Promise<T> {
  return request<T>(url, { method: 'GET' }, auth);
}

// POST 请求
export function post<T>(url: string, body: unknown, auth = true): Promise<T> {
  return request<T>(url, { method: 'POST', body: JSON.stringify(body) }, auth);
}

// PUT 请求
export function put<T>(url: string, body: unknown, auth = true): Promise<T> {
  return request<T>(url, { method: 'PUT', body: JSON.stringify(body) }, auth);
}

// DELETE 请求
export function del<T>(url: string, auth = true): Promise<T> {
  return request<T>(url, { method: 'DELETE' }, auth);
}