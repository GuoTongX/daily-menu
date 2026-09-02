// ===== 认证相关 API =====
import { get, post } from './http';
import type { AuthResponse, User } from '../types';

// 注册：发送验证码（第一步）
export function registerSendCode(username: string, password: string, email: string): Promise<{ message: string; devCode?: string }> {
  return post<{ message: string; devCode?: string }>('/api/auth/register/send-code', { username, password, email }, false);
}

// 注册：确认验证码（第二步）
export function registerConfirm(email: string, code: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/register/confirm', { email, code }, false);
}

// 登录
export function login(username: string, password: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/login', { username, password }, false);
}

// 获取当前用户
export function getMe(): Promise<User> {
  return get<User>('/api/auth/me');
}

// 找回密码 - 发送验证码
export function forgotPasswordSendCode(email: string): Promise<{ message: string; devCode?: string }> {
  return post<{ message: string; devCode?: string }>('/api/auth/forgot-password/send-code', { email }, false);
}

// 找回密码 - 重置
export function forgotPasswordReset(email: string, code: string, newPassword: string): Promise<{ message: string }> {
  return post<{ message: string }>('/api/auth/forgot-password/reset', { email, code, new_password: newPassword }, false);
}