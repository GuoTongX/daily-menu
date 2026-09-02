// ===== 登录/注册/找回密码页 =====
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { registerSendCode, registerConfirm, forgotPasswordSendCode, forgotPasswordReset } from '../api/auth';
import { passwordError, PASSWORD_HINT } from '../utils/password';

type PageMode = 'login' | 'register' | 'forgot';

export default function Login() {
  const [mode, setMode] = useState<PageMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  // 注册两步流程状态
  const [regStep, setRegStep] = useState<'form' | 'code'>('form');
  const [regCode, setRegCode] = useState('');
  const [regDevCode, setRegDevCode] = useState('');

  // 找回密码状态
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotCode, setForgotCode] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotNewPassword2, setForgotNewPassword2] = useState('');
  const [forgotStep, setForgotStep] = useState<'email' | 'code' | 'done'>('email');
  const [forgotDevCode, setForgotDevCode] = useState('');

  const navigate = useNavigate();
  const { login } = useAuth();

  // 切换模式，清空所有输入
  const switchMode = (m: PageMode) => {
    setMode(m);
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setError('');
    setNotice('');
    setRegStep('form');
    setRegCode('');
    setRegDevCode('');
    setForgotEmail('');
    setForgotCode('');
    setForgotNewPassword('');
    setForgotNewPassword2('');
    setForgotStep('email');
    setForgotDevCode('');
  };

  // 提交登录
  const handleSubmit = async () => {
    setError('');

    if (!username.trim() || !password) {
      setError('请输入用户名/邮箱和密码');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
        navigate('/');
      }
    } catch (e) {
      const msg = (e as Error).message || '操作失败';
      if (msg.includes('已注销')) {
        setError('账号已注销，无法登录');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // 注册：发送验证码（第一步）
  const handleRegisterSendCode = async () => {
    setError('');
    const trimmedUser = username.trim();
    if (!trimmedUser) { setError('请输入用户名'); return; }
    if (trimmedUser.length < 2) { setError('用户名至少 2 个字符'); return; }
    if (trimmedUser.length > 30) { setError('用户名不能超过 30 个字符'); return; }
    if (!password) { setError('请输入密码'); return; }
    const pwdErr = passwordError(password);
    if (pwdErr) { setError(pwdErr); return; }
    if (!email.trim() || !email.includes('@')) { setError('请填写有效的邮箱地址'); return; }
    if (password !== confirmPassword) { setError('两次输入的密码不一致'); return; }

    setLoading(true);
    try {
      const res = await registerSendCode(trimmedUser, password, email.trim());
      if (res.devCode) setRegDevCode(res.devCode);
      setRegStep('code');
    } catch (e) {
      setError((e as Error).message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  // 注册：确认验证码（第二步）
  const handleRegisterConfirm = async () => {
    setError('');
    if (!regCode.trim()) { setError('请输入验证码'); return; }

    setLoading(true);
    try {
      const savedUsername = username.trim();
      await registerConfirm(email.trim(), regCode.trim());
      // 注册成功：返回登录页，用用户名与密码重新登录，不直接进入系统
      setMode('login');
      setRegStep('form');
      setUsername(savedUsername);
      setPassword('');
      setConfirmPassword('');
      setEmail('');
      setRegCode('');
      setRegDevCode('');
      setNotice('注册成功，请登录');
    } catch (e) {
      setError((e as Error).message || '验证失败');
    } finally {
      setLoading(false);
    }
  };

  // 找回密码 - 发送验证码
  const handleForgotSendCode = async () => {
    setError('');
    if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
      setError('请输入有效的邮箱地址');
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPasswordSendCode(forgotEmail.trim());
      if (res.devCode) {
        setForgotDevCode(res.devCode);
      }
      setForgotStep('code');
    } catch (e) {
      setError((e as Error).message || '发送失败');
    } finally {
      setLoading(false);
    }
  };

  // 找回密码 - 重置
  const handleForgotReset = async () => {
    setError('');
    if (!forgotCode.trim()) {
      setError('请输入验证码');
      return;
    }
    const pwdErr = passwordError(forgotNewPassword);
    if (pwdErr) {
      setError(pwdErr);
      return;
    }
    if (forgotNewPassword !== forgotNewPassword2) {
      setError('两次输入的密码不一致');
      return;
    }
    setLoading(true);
    try {
      await forgotPasswordReset(forgotEmail.trim(), forgotCode.trim(), forgotNewPassword);
      setForgotStep('done');
    } catch (e) {
      setError((e as Error).message || '重置失败');
    } finally {
      setLoading(false);
    }
  };

  // 找回密码成功页面
  if (mode === 'forgot' && forgotStep === 'done') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: 'var(--color-bg)', padding: 20,
      }}>
        <div style={{
          maxWidth: 400, width: '100%', padding: 32, textAlign: 'center',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-card)',
        }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, fontWeight: 700,
          }}>食</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>密码已重置</h2>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
            请使用新密码登录
          </p>
          <button
            onClick={() => switchMode('login')}
            style={{
              padding: '10px 24px', fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              borderRadius: 'var(--radius-btn)',
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)',
            }}
          >
            去登录
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--color-bg)', padding: 20,
    }}>
      <div style={{
        maxWidth: 400, width: '100%', padding: 32,
        borderRadius: 'var(--radius-card)',
        border: '1px solid var(--color-border)',
        background: 'var(--color-surface)',
        boxShadow: 'var(--shadow-card)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={{
            width: 48, height: 48, margin: '0 auto 12px',
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-primary-strong))',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontSize: 24, fontWeight: 700,
          }}>食</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>每日食方</h2>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>智能食谱规划</p>
        </div>

        {/* 模式切换（找回密码不显示选项卡） */}
        {mode !== 'forgot' && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex' }}>
              {(['login', 'register'] as const).map((m) => (
                <div
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    flex: 1, padding: '10px 10px 12px', textAlign: 'center', cursor: 'pointer',
                    fontWeight: 500, color: mode === m ? 'var(--color-primary)' : 'var(--color-text-muted)',
                    boxShadow: mode === m ? 'inset 0 -2px 0 var(--color-primary)' : 'none',
                  }}
                >
                  {m === 'login' ? '登录' : '注册'}
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--color-border)' }} />
          </div>
        )}

        {/* 找回密码流程 */}
        {mode === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <button
                onClick={() => switchMode('login')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 13, color: 'var(--color-primary)', fontFamily: 'inherit',
                }}
              >
                ← 返回登录
              </button>
            </div>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, marginBottom: 4 }}>找回密码</h3>

            {/* 第一步：输入邮箱 */}
            {forgotStep === 'email' && (
              <>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                    绑定邮箱
                  </label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="请输入绑定的邮箱地址"
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--color-border)', fontSize: 14,
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                {error && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 13,
                    background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger-border)',
                  }}>
                    {error}
                  </div>
                )}
                <button
                  onClick={handleForgotSendCode}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '10px 24px', borderRadius: 'var(--radius-btn)',
                    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                    color: 'white', border: '1px solid var(--color-primary-strong)',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? '发送中...' : '发送验证码'}
                </button>
              </>
            )}

            {/* 第二步：输入验证码 + 新密码 */}
            {forgotStep === 'code' && (
              <>
                {forgotDevCode && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 13,
                    background: 'var(--color-info-bg)', color: 'var(--color-info)',
                    border: '1px solid var(--color-info-border)',
                  }}>
                    开发模式验证码：<strong>{forgotDevCode}</strong>（SMTP 未配置时显示）
                  </div>
                )}
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                    验证码
                  </label>
                  <input
                    type="text"
                    value={forgotCode}
                    onChange={(e) => setForgotCode(e.target.value)}
                    placeholder="6 位数字验证码"
                    maxLength={6}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--color-border)', fontSize: 14,
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                    新密码
                  </label>
                  <input
                    type="password"
                    value={forgotNewPassword}
                    onChange={(e) => setForgotNewPassword(e.target.value)}
                    placeholder={PASSWORD_HINT}
                    maxLength={12}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--color-border)', fontSize: 14,
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                    确认新密码
                  </label>
                  <input
                    type="password"
                    value={forgotNewPassword2}
                    onChange={(e) => setForgotNewPassword2(e.target.value)}
                    placeholder="请再次输入新密码"
                    maxLength={12}
                    onKeyDown={(e) => e.key === 'Enter' && handleForgotReset()}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: 6,
                      border: '1px solid var(--color-border)', fontSize: 14,
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                </div>
                {error && (
                  <div style={{
                    padding: '8px 12px', borderRadius: 6, fontSize: 13,
                    background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                    border: '1px solid var(--color-danger-border)',
                  }}>
                    {error}
                  </div>
                )}
                <button
                  onClick={handleForgotReset}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '10px 24px', borderRadius: 'var(--radius-btn)',
                    fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                    background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                    color: 'white', border: '1px solid var(--color-primary-strong)',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? '重置中...' : '重置密码'}
                </button>
                <button
                  onClick={handleForgotSendCode}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '8px', borderRadius: 'var(--radius-btn)',
                    fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    background: 'none', border: 'none', color: 'var(--color-primary)',
                  }}
                >
                  重新发送验证码
                </button>
              </>
            )}
          </div>
        )}

        {/* 登录表单 */}
        {mode === 'login' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                用户名或邮箱
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名或邮箱"
                maxLength={255}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                maxLength={12}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {notice && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: 'var(--color-info-bg)', color: 'var(--color-info)',
                border: '1px solid var(--color-info-border)',
              }}>
                {notice}
              </div>
            )}
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                border: '1px solid var(--color-danger-border)',
              }}>
                {error}
              </div>
            )}
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '10px 24px', borderRadius: 'var(--radius-btn)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                color: 'white', border: '1px solid var(--color-primary-strong)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '处理中...' : '登 录'}
            </button>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <button
                onClick={() => switchMode('forgot')}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  fontSize: 13, color: 'var(--color-primary)', fontFamily: 'inherit',
                }}
              >
                忘记密码？
              </button>
            </div>
          </div>
        )}

        {/* 注册：第一步，填写信息 */}
        {mode === 'register' && regStep === 'form' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                maxLength={30}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                邮箱
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="用于登录与找回密码"
                maxLength={255}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={PASSWORD_HINT}
                maxLength={12}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                maxLength={12}
                onKeyDown={(e) => e.key === 'Enter' && handleRegisterSendCode()}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                border: '1px solid var(--color-danger-border)',
              }}>
                {error}
              </div>
            )}
            <button
              onClick={handleRegisterSendCode}
              disabled={loading}
              style={{
                width: '100%', padding: '10px 24px', borderRadius: 'var(--radius-btn)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                color: 'white', border: '1px solid var(--color-primary-strong)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '发送中...' : '发送验证码'}
            </button>
          </div>
        )}

        {/* 注册：第二步，输入验证码 */}
        {mode === 'register' && regStep === 'code' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              验证码已发送到 <strong>{email}</strong>
            </div>
            {regDevCode && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: 'var(--color-muted)', color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}>
                开发模式验证码：<strong>{regDevCode}</strong>
              </div>
            )}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: 'var(--color-text-muted)' }}>
                验证码
              </label>
              <input
                type="text"
                value={regCode}
                onChange={(e) => setRegCode(e.target.value)}
                placeholder="6 位数字验证码"
                maxLength={6}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRegisterConfirm()}
                style={{
                  width: '100%', padding: '8px 12px', borderRadius: 6,
                  border: '1px solid var(--color-border)', fontSize: 14,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {error && (
              <div style={{
                padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: 'var(--color-danger-bg)', color: 'var(--color-danger)',
                border: '1px solid var(--color-danger-border)',
              }}>
                {error}
              </div>
            )}
            <button
              onClick={handleRegisterConfirm}
              disabled={loading}
              style={{
                width: '100%', padding: '10px 24px', borderRadius: 'var(--radius-btn)',
                fontSize: 15, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                color: 'white', border: '1px solid var(--color-primary-strong)',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? '验证中...' : '确认注册'}
            </button>
            <button
              onClick={() => { setRegStep('form'); setRegCode(''); setRegDevCode(''); setError(''); }}
              style={{
                width: '100%', padding: '8px', borderRadius: 'var(--radius-btn)',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                background: 'none', border: 'none', color: 'var(--color-text-muted)',
              }}
            >
              ← 返回修改
            </button>
          </div>
        )}
      </div>
    </div>
  );
}