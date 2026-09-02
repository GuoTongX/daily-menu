// ===== 账户管理 API（邮箱绑定、修改密码、注销账号） =====
import { post } from './http';
import type { User } from '../types';

// 绑定/更换邮箱 - 发送验证码（需验证当前密码）
export function bindEmailSendCode(email: string, password: string): Promise<{ message: string; devCode?: string }> {
  return post<{ message: string; devCode?: string }>('/api/account/bind-email/send-code', { email, password });
}

// 绑定/更换邮箱 - 确认验证
export function bindEmailConfirm(email: string, code: string): Promise<User> {
  return post<User>('/api/account/bind-email/confirm', { email, code });
}

// 修改密码
export function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  return post<{ message: string }>('/api/account/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// 注销账号：发送验证码到当前邮箱（第一步）
export function deactivateSendCode(password: string): Promise<{ message: string; devCode?: string }> {
  return post<{ message: string; devCode?: string }>('/api/account/deactivate/send-code', { password });
}

// 注销账号：确认验证码（第二步）
export function deactivateConfirm(code: string): Promise<{ message: string }> {
  return post<{ message: string }>('/api/account/deactivate/confirm', { code });
}