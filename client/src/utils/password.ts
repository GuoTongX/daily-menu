// ===== 密码规则：8-12 位，仅限字母+数字，且必须同时包含字母和数字（区分大小写） =====
export const PASSWORD_HINT = '8-12 位，需同时包含字母和数字';

export function passwordError(pw: string): string | null {
  if (!pw) return '请输入密码';
  if (pw.length < 8 || pw.length > 12) return '密码需为 8-12 位';
  if (!/^[A-Za-z0-9]+$/.test(pw)) return '密码只能包含字母和数字';
  if (!/[A-Za-z]/.test(pw) || !/[0-9]/.test(pw)) return '密码需同时包含字母和数字';
  return null;
}
