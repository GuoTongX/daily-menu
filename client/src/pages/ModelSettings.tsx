// ===== 模型设置页面：表单模式 / JSON 模式（不做双向同步） =====
import { useState, useEffect } from 'react';
import { getLlmConfig, saveLlmConfig, testLlmConnection } from '../api/settings';
import type { LlmConfig } from '../types';
import { showToast } from '../components/ui/Toast';

// 默认配置（表单模式只包含三个基本参数）
const DEFAULT_CONFIG: LlmConfig = {
  baseUrl: '',
  apiKey: '',
  params: {
    model: '',
  },
};

// 把配置对象转为格式化的 JSON 字符串
function configToJson(c: LlmConfig): string {
  return JSON.stringify(c, null, 2);
}

export default function ModelSettings() {
  const [config, setConfig] = useState<LlmConfig>(DEFAULT_CONFIG);
  const [jsonText, setJsonText] = useState(configToJson(DEFAULT_CONFIG));
  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // 加载配置
  useEffect(() => {
    getLlmConfig().then((c) => {
      if (c) {
        setConfig(c);
        setJsonText(configToJson(c));
      }
    }).catch(() => {});
  }, []);

  // 表单字段更新（仅更新表单，不同步到 JSON）
  const updateConfig = (next: LlmConfig) => {
    setConfig(next);
  };

  // 更新 params 里的某个字段（表单模式用）
  const updateParam = (field: string, value: unknown) => {
    updateConfig({
      ...config,
      params: { ...config.params, [field]: value },
    });
  };

  // JSON 编辑（仅更新 JSON，不同步到表单）
  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.baseUrl === 'string' &&
          typeof parsed.apiKey === 'string' &&
          typeof parsed.params === 'object' &&
          parsed.params !== null) {
        setJsonError('');
      } else {
        setJsonError('JSON 格式错误，缺少 baseUrl、apiKey 或 params');
      }
    } catch {
      setJsonError('JSON 格式错误，请检查');
    }
  };

  // 表单模式必填校验
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!config.baseUrl.trim()) {
      errors.baseUrl = '请填写 API Base URL';
    }
    if (!config.apiKey.trim()) {
      errors.apiKey = '请填写 API Key';
    }
    const modelVal = (config.params?.model as string) || '';
    if (!modelVal.trim()) {
      errors.model = '请填写模型 ID';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // 保存（始终以当前 JSON 文本为准保存）
  const handleSave = async () => {
    setSaving(true);
    setError('');
    setTestResult(null);
    try {
      let parsed: LlmConfig;
      if (mode === 'json') {
        parsed = JSON.parse(jsonText);
        if (typeof parsed.baseUrl !== 'string' ||
            typeof parsed.apiKey !== 'string' ||
            typeof parsed.params !== 'object' ||
            parsed.params === null) {
          showToast('保存失败：JSON 配置不完整，需要 baseUrl、apiKey、params', 'error');
          setSaving(false);
          return;
        }
      } else {
        // 表单模式：先校验必填
        if (!validateForm()) {
          showToast('请填写所有必填项', 'info');
          setSaving(false);
          return;
        }
        parsed = config;
      }
      await saveLlmConfig(parsed);
      showToast('配置已保存', 'success');
      // 保存后同步 JSON 文本
      setJsonText(configToJson(parsed));
      setFieldErrors({});
    } catch (e) {
      showToast('保存失败: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // 测试连接（以当前配置为准）
  const handleTest = async () => {
    setTesting(true);
    setError('');
    setTestResult(null);
    try {
      let testConfig: LlmConfig;
      if (mode === 'json') {
        testConfig = JSON.parse(jsonText);
      } else {
        testConfig = config;
      }
      const result = await testLlmConnection(testConfig);
      setTestResult(result);
    } catch (e) {
      setTestResult({ ok: false, message: '测试失败: ' + (e as Error).message });
    } finally {
      setTesting(false);
    }
  };

  const modelVal = (config.params?.model as string) || '';

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>模型设置</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14 }}>表单模式填入基本信息，JSON 模式自由配置高级参数。</p>
      </div>

      {/* 模式切换 */}
      <div style={{
        display: 'flex', gap: 0, marginBottom: 20,
        border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden',
        width: 'fit-content',
      }}>
        {(['form', 'json'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '8px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: 'none', fontFamily: 'inherit',
              background: mode === m ? 'var(--color-primary)' : 'var(--color-surface)',
              color: mode === m ? 'white' : 'var(--color-text-muted)',
            }}
          >
            {m === 'form' ? '表单模式' : 'JSON 模式'}
          </button>
        ))}
      </div>

      {/* 配置表单 / JSON 编辑器 */}
      <div className="card" style={{ padding: 24, borderRadius: 'var(--radius-card)', border: '1px solid var(--color-border)' }}>
        {mode === 'form' ? (
          /* ===== 表单模式：三个基本参数 ===== */
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>API Base URL<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
              <input
                value={config.baseUrl}
                onChange={(e) => { updateConfig({ ...config, baseUrl: e.target.value }); setFieldErrors((fe) => ({ ...fe, baseUrl: '' })); }}
                placeholder="例如：https://api.deepseek.com/v1"
                maxLength={500}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${fieldErrors.baseUrl ? 'var(--color-danger)' : 'var(--color-border)'}`, fontSize: 14, background: 'var(--color-surface)', boxSizing: 'border-box' }}
              />
              {fieldErrors.baseUrl && (
                <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.baseUrl}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>模型服务的接口地址，需以 /v1 结尾。支持 OpenAI 兼容接口。</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>API Key<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => { updateConfig({ ...config, apiKey: e.target.value }); setFieldErrors((fe) => ({ ...fe, apiKey: '' })); }}
                placeholder="sk-..."
                maxLength={500}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${fieldErrors.apiKey ? 'var(--color-danger)' : 'var(--color-border)'}`, fontSize: 14, background: 'var(--color-surface)', boxSizing: 'border-box' }}
              />
              {fieldErrors.apiKey && (
                <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.apiKey}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>访问模型的密钥，仅保存在你自己的本地数据库中。</p>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, fontWeight: 500, marginBottom: 6, display: 'block', color: 'var(--color-text-muted)' }}>模型 ID<span style={{ color: 'var(--color-danger)', marginLeft: 2 }}>*</span></label>
              <input
                value={modelVal}
                onChange={(e) => { updateParam('model', e.target.value); setFieldErrors((fe) => ({ ...fe, model: '' })); }}
                placeholder="例如：deepseek-chat / gpt-4o-mini"
                maxLength={200}
                style={{ width: '100%', padding: '8px 12px', borderRadius: 6, border: `1px solid ${fieldErrors.model ? 'var(--color-danger)' : 'var(--color-border)'}`, fontSize: 14, background: 'var(--color-surface)', boxSizing: 'border-box' }}
              />
              {fieldErrors.model && (
                <p style={{ fontSize: 12, color: 'var(--color-danger)', marginTop: 4 }}>{fieldErrors.model}</p>
              )}
              <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>具体使用的模型名称，不同服务提供的模型不同。</p>
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>
              表单模式仅提供三个基本参数。切换到 JSON 模式可自定义更多参数（温度、思考等级等）。
            </p>
          </>
        ) : (
          /* ===== JSON 模式：自由编辑 ===== */
          <>
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-muted)' }}>配置 JSON（params 中的参数会原样发送给云端模型）</label>
                {jsonError && (
                  <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{jsonError}</span>
                )}
              </div>
              <textarea
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                spellCheck={false}
                style={{
                  width: '100%', minHeight: 260, padding: 12,
                  borderRadius: 6, border: `1px solid ${jsonError ? 'var(--color-danger)' : 'var(--color-border)'}`,
                  fontSize: 13, fontFamily: 'monospace', lineHeight: 1.5,
                  background: 'var(--color-surface)', color: 'var(--color-text)',
                  resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>
            <p style={{ fontSize: 12, color: 'var(--color-text-subtle)', marginTop: 4 }}>
              在 JSON 模式下可以自由添加 temperature、reasoning_effort 等高级参数，全部会原样发送给云端模型。
              表单模式和 JSON 模式各自独立编辑，互不同步。
            </p>
          </>
        )}

        {/* 操作按钮（通用） */}
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 'var(--radius-btn)',
              border: '1px solid var(--color-border)', background: 'var(--color-surface)',
            }}
          >
            {testing ? '测试中...' : '测试连接'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '8px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 'var(--radius-btn)',
              background: 'linear-gradient(180deg, var(--color-primary), var(--color-primary-strong))',
              color: 'white', border: '1px solid var(--color-primary-strong)', opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>

        {/* 测试结果 */}
        {testResult && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8, fontSize: 13,
            background: testResult.ok ? 'var(--color-primary-subtle)' : 'var(--color-danger-bg)',
            color: testResult.ok ? 'var(--color-primary)' : 'var(--color-danger)',
            border: `1px solid ${testResult.ok ? 'var(--color-primary-border)' : 'var(--color-danger-border)'}`,
          }}>
            {testResult.ok ? '连接成功 ✓' : testResult.message}
          </div>
        )}

        {error && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8, fontSize: 13,
            background: 'var(--color-primary-subtle)', color: 'var(--color-primary)',
            border: '1px solid var(--color-primary-border)',
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}