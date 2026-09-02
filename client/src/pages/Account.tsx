// ===== 账户页面：用户信息 + 邮箱管理 + 安全设置 =====
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bindEmailSendCode, bindEmailConfirm, changePassword, deactivateSendCode, deactivateConfirm } from '../api/account';
import Icon from '../components/ui/Icon';
import { showToast } from '../components/ui/Toast';
import { passwordError, PASSWORD_HINT } from '../utils/password';

export default function Account() {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();

  // 邮箱绑定状态
  const [bindEmailInput, setBindEmailInput] = useState('');
  const [bindCode, setBindCode] = useState('');
  const [bindStep, setBindStep] = useState<'idle' | 'send-code' | 'confirm'>('idle');
  const [bindDevCode, setBindDevCode] = useState('');
  const [bindPassword, setBindPassword] = useState('');
  const [bindLoading, setBindLoading] = useState(false);

  // 修改密码状态
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [curPwd, setCurPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);

  // 注销状态（两步验证码）
  const [showDeactivate, setShowDeactivate] = useState(false);
  const [deactivatePwd, setDeactivatePwd] = useState('');
  const [deactivateCode, setDeactivateCode] = useState('');
  const [deactivateStep, setDeactivateStep] = useState<'pwd' | 'code'>('pwd');
  const [deactivateDevCode, setDeactivateDevCode] = useState('');
  const [deactivateError, setDeactivateError] = useState('');
  const [deactivateLoading, setDeactivateLoading] = useState(false);

  // 重置邮箱绑定/更换表单（重新打开时输入框内容必须为空）
  const resetBind = () => {
    setBindEmailInput('');
    setBindCode('');
    setBindDevCode('');
    setBindPassword('');
    setBindLoading(false);
  };

  // 退出登录
  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // 格式化创建时间
  const createdDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  // ===== 邮箱绑定/更换 =====
  const handleBindSendCode = async () => {
    if (!bindEmailInput.trim() || !bindEmailInput.includes('@')) {
      showToast('请输入有效的邮箱地址', 'error');
      return;
    }
    if (!bindPassword) {
      showToast('请输入当前密码以确认身份', 'error');
      return;
    }
    setBindLoading(true);
    try {
      const res = await bindEmailSendCode(bindEmailInput.trim(), bindPassword);
      if (res.devCode) setBindDevCode(res.devCode);
      // 进入验证码确认阶段，密码不再使用，立即清空
      setBindPassword('');
      setBindStep('confirm');
      showToast('验证码已发送', 'success');
    } catch (e) {
      showToast((e as Error).message || '发送失败', 'error');
    } finally {
      setBindLoading(false);
    }
  };

  const handleBindConfirm = async () => {
    if (!bindCode.trim()) {
      showToast('请输入验证码', 'error');
      return;
    }
    setBindLoading(true);
    try {
      await bindEmailConfirm(bindEmailInput.trim(), bindCode.trim());
      await refreshUser();
      // 重置所有字段，保证再次打开更换邮箱时输入框内容为空
      resetBind();
      setBindStep('idle');
      showToast('邮箱绑定成功', 'success');
    } catch (e) {
      showToast((e as Error).message || '绑定失败', 'error');
    } finally {
      setBindLoading(false);
    }
  };

  // ===== 修改密码 =====
  const handleChangePwd = async () => {
    setPwdError('');
    if (!curPwd) { setPwdError('请输入当前密码'); return; }
    const pwdErr = passwordError(newPwd);
    if (pwdErr) { setPwdError(pwdErr); return; }
    if (newPwd === curPwd) { setPwdError('新密码不能与当前密码相同'); return; }
    if (newPwd !== confirmPwd) { setPwdError('两次输入的密码不一致'); return; }
    setPwdLoading(true);
    try {
      await changePassword(curPwd, newPwd);
      setShowChangePwd(false);
      setCurPwd('');
      setNewPwd('');
      setConfirmPwd('');
      showToast('密码已修改', 'success');
    } catch (e) {
      setPwdError((e as Error).message || '修改失败');
    } finally {
      setPwdLoading(false);
    }
  };

  // ===== 注销账号：第一步，输入密码发验证码 =====
  const handleDeactivateSendCode = async () => {
    setDeactivateError('');
    if (!deactivatePwd) { setDeactivateError('请输入密码确认身份'); return; }
    setDeactivateLoading(true);
    try {
      const res = await deactivateSendCode(deactivatePwd);
      setDeactivateDevCode(res.devCode || '');
      setDeactivateStep('code');
    } catch (e) {
      setDeactivateError((e as Error).message || '发送失败');
    } finally {
      setDeactivateLoading(false);
    }
  };

  // ===== 注销账号：第二步，验证码确认 =====
  const handleDeactivateConfirm = async () => {
    setDeactivateError('');
    if (!deactivateCode) { setDeactivateError('请输入验证码'); return; }
    setDeactivateLoading(true);
    try {
      await deactivateConfirm(deactivateCode);
      logout();
      navigate('/login');
      setTimeout(() => alert('账号已注销'), 100);
    } catch (e) {
      setDeactivateError((e as Error).message || '注销失败');
    } finally {
      setDeactivateLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>账户</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>你的个人信息与账户安全设置。</p>
      </div>

      <div style={{ maxWidth: 500 }}>
        {/* 用户信息卡片 */}
        <div style={{
          padding: 24, marginBottom: 20,
          borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 16,
            marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--color-border)',
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--color-primary)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 600,
            }}>
              {user?.username?.charAt(0) || '?'}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-text)' }}>
                {user?.username || '未登录'}
              </div>
              {createdDate && (
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 2 }}>
                  注册于 {createdDate}
                </div>
              )}
            </div>
          </div>

          {/* 邮箱管理 */}
          <div style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="tag" size={14} color="var(--color-primary)" />
              邮箱
            </h3>
            {(() => {
              // 邮箱已绑定且空闲 → 显示邮箱信息 + 更换按钮
              if (user?.email && bindStep === 'idle') {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 8, background: 'var(--color-muted)' }}>
                    <span style={{ fontSize: 14, color: 'var(--color-text)' }}>{user.email}</span>
                    <button
                      onClick={() => { resetBind(); setBindStep('send-code'); }}
                      style={{
                        padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                        borderRadius: 6, border: '1px solid var(--color-primary-border)',
                        color: 'var(--color-primary)', background: 'var(--color-primary-subtle)',
                      }}
                    >
                      更换邮箱
                    </button>
                  </div>
                );
              }
              // 空闲状态 → 无邮箱时显示绑定按钮
              if (bindStep === 'idle') {
                return (
                  <button
                    onClick={() => { resetBind(); setBindStep('send-code'); }}
                    style={{
                      padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      borderRadius: 'var(--radius-btn)',
                      background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                      color: 'white', border: '1px solid var(--color-primary-strong)',
                    }}
                  >
                    绑定邮箱
                  </button>
                );
              }
              // 发送验证码 / 确认绑定
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px', borderRadius: 8, background: 'var(--color-muted)' }}>
                  {bindStep === 'send-code' && (
                    <>
                      <input
                        type="email"
                        value={bindEmailInput}
                        onChange={(e) => setBindEmailInput(e.target.value)}
                        placeholder="输入新邮箱地址"
                        style={{
                          padding: '8px 12px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)', color: 'var(--color-text)',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                      <input
                        type="password"
                        value={bindPassword}
                        onChange={(e) => setBindPassword(e.target.value)}
                        placeholder="输入当前密码以确认身份"
                        style={{
                          padding: '8px 12px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)', color: 'var(--color-text)',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                      <button
                        onClick={handleBindSendCode}
                        disabled={bindLoading}
                        style={{
                          padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 'var(--radius-btn)',
                          background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                          color: 'white', border: '1px solid var(--color-primary-strong)',
                          opacity: bindLoading ? 0.6 : 1,
                        }}
                      >
                        {bindLoading ? '发送中...' : '发送验证码'}
                      </button>
                      <button
                        onClick={() => { resetBind(); setBindStep('idle'); }}
                        style={{
                          padding: '6px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                          borderRadius: 'var(--radius-btn)', border: 'none', background: 'none',
                          color: 'var(--color-text-muted)',
                        }}
                      >
                        取消
                      </button>
                    </>
                  )}
                  {bindStep === 'confirm' && (
                    <>
                      <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                        验证码已发送到 <strong>{bindEmailInput}</strong>
                      </div>
                      {bindDevCode && (
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                          开发模式验证码：<strong>{bindDevCode}</strong>
                        </div>
                      )}
                      <input
                        type="text"
                        value={bindCode}
                        onChange={(e) => setBindCode(e.target.value)}
                        placeholder="6 位验证码"
                        maxLength={6}
                        style={{
                          padding: '8px 12px', borderRadius: 6, fontSize: 14,
                          border: '1px solid var(--color-border)',
                          background: 'var(--color-surface)', color: 'var(--color-text)',
                          outline: 'none', fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          onClick={handleBindConfirm}
                          disabled={bindLoading}
                          style={{
                            flex: 1, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            borderRadius: 'var(--radius-btn)',
                            background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                            color: 'white', border: '1px solid var(--color-primary-strong)',
                            opacity: bindLoading ? 0.6 : 1,
                          }}
                        >
                          {bindLoading ? '验证中...' : '确认绑定'}
                        </button>
                        <button
                          onClick={() => { resetBind(); setBindStep('idle'); }}
                          style={{
                            padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                            borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)',
                            background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* 安全设置卡片 */}
        <div style={{
          padding: 24, marginBottom: 20,
          borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)',
          background: 'var(--color-surface)',
        }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-circle" size={14} color="var(--color-primary)" />
            安全设置
          </h3>

          {/* 修改密码 */}
          {!showChangePwd ? (
            <button
              onClick={() => setShowChangePwd(true)}
              style={{
                width: '100%', padding: '10px', marginBottom: 12, borderRadius: 'var(--radius-btn)',
                border: '1px solid var(--color-border)', color: 'var(--color-text)',
                background: 'var(--color-muted)', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, fontFamily: 'inherit', textAlign: 'center',
              }}
            >
              修改密码
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12, padding: 12, borderRadius: 8, background: 'var(--color-muted)' }}>
              <input
                type="password"
                value={curPwd}
                onChange={(e) => setCurPwd(e.target.value)}
                placeholder="当前密码"
                maxLength={12}
                style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 14,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <input
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder={`新密码（${PASSWORD_HINT}）`}
                maxLength={12}
                style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 14,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              <input
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="确认新密码"
                maxLength={12}
                style={{
                  padding: '8px 12px', borderRadius: 6, fontSize: 14,
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
              {pwdError && (
                <div style={{ fontSize: 13, color: 'var(--color-danger)' }}>{pwdError}</div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={handleChangePwd}
                  disabled={pwdLoading}
                  style={{
                    flex: 1, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 'var(--radius-btn)',
                    background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
                    color: 'white', border: '1px solid var(--color-primary-strong)',
                    opacity: pwdLoading ? 0.6 : 1,
                  }}
                >
                  {pwdLoading ? '修改中...' : '确认修改'}
                </button>
                <button
                  onClick={() => { setShowChangePwd(false); setCurPwd(''); setNewPwd(''); setConfirmPwd(''); setPwdError(''); }}
                  style={{
                    padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)',
                    background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}

          {/* 注销账号 */}
          {!showDeactivate ? (
            <button
              onClick={() => setShowDeactivate(true)}
              style={{
                width: '100%', padding: '10px', borderRadius: 'var(--radius-btn)',
                border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)',
                background: 'var(--color-danger-bg)', cursor: 'pointer',
                fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
              }}
            >
              注销账号
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 12, borderRadius: 8, background: 'var(--color-muted)' }}>
              <div style={{ fontSize: 13, color: 'var(--color-danger)' }}>
                注销后账号将无法登录，数据将被保留但不提供访问。将发送验证码到你的邮箱确认。
              </div>
              {deactivateStep === 'pwd' && (
                <>
                  <input
                    type="password"
                    value={deactivatePwd}
                    onChange={(e) => setDeactivatePwd(e.target.value)}
                    placeholder="输入当前密码"
                    style={{
                      padding: '8px 12px', borderRadius: 6, fontSize: 14,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDeactivateSendCode}
                      disabled={deactivateLoading}
                      style={{
                        flex: 1, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        borderRadius: 'var(--radius-btn)',
                        border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)',
                        background: 'var(--color-danger-bg)', opacity: deactivateLoading ? 0.6 : 1,
                      }}
                    >
                      {deactivateLoading ? '发送中...' : '发送验证码'}
                    </button>
                    <button
                      onClick={() => { setShowDeactivate(false); setDeactivatePwd(''); setDeactivateError(''); }}
                      style={{
                        padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                      }}
                    >
                      取消
                    </button>
                  </div>
                </>
              )}
              {deactivateStep === 'code' && (
                <>
                  <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                    验证码已发送到你的邮箱
                  </div>
                  {deactivateDevCode && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      开发模式验证码：<strong>{deactivateDevCode}</strong>
                    </div>
                  )}
                  <input
                    type="text"
                    value={deactivateCode}
                    onChange={(e) => setDeactivateCode(e.target.value)}
                    placeholder="6 位验证码"
                    maxLength={6}
                    style={{
                      padding: '8px 12px', borderRadius: 6, fontSize: 14,
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-surface)', color: 'var(--color-text)',
                      outline: 'none', fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={handleDeactivateConfirm}
                      disabled={deactivateLoading}
                      style={{
                        flex: 1, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        borderRadius: 'var(--radius-btn)',
                        border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)',
                        background: 'var(--color-danger-bg)', opacity: deactivateLoading ? 0.6 : 1,
                      }}
                    >
                      {deactivateLoading ? '处理中...' : '确认注销'}
                    </button>
                    <button
                      onClick={() => { setDeactivateStep('pwd'); setDeactivatePwd(''); setDeactivateCode(''); setDeactivateDevCode(''); setDeactivateError(''); }}
                      style={{
                        padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                        borderRadius: 'var(--radius-btn)', border: '1px solid var(--color-border)',
                        background: 'var(--color-surface)', color: 'var(--color-text-muted)',
                      }}
                    >
                      返回
                    </button>
                  </div>
                </>
              )}
              {deactivateError && (
                <div style={{ fontSize: 13, color: 'var(--color-danger)' }}>{deactivateError}</div>
              )}
            </div>
          )}
        </div>

        {/* 退出登录 */}
        <button
          onClick={handleLogout}
          style={{
            width: '100%', padding: '10px', borderRadius: 'var(--radius-btn)',
            border: '1px solid var(--color-danger-border)', color: 'var(--color-danger)',
            background: 'var(--color-danger-bg)', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, fontFamily: 'inherit',
          }}
        >
          退出登录
        </button>
      </div>
    </div>
  );
}