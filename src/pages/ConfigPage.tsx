import React, { useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Download, Eye, EyeOff, FolderOpen, Plus, Save, Trash2, Upload, X } from 'lucide-react';
import { useConfig } from '../context/useConfig';
import { PLATFORM_DEFS } from '../services/modelTemplates';
import { MAX_IMPORT_FILE_SIZE, SAFE_CONFIG_EXPORT_FILENAME, parseImportedConfigText, serializeConfigForExport } from '../services/configImportExport';
import { getApiSafeMessage } from '../services/api/errorNormalizer';
import BuiltinPlatformCard from './config/BuiltinPlatformCard';
import CustomPlatformCard from './config/CustomPlatformCard';
import { emptyPlatform } from './config/utils';
import UpdatePanel from '../components/UpdatePanel';

const ConfigPage: React.FC = () => {
  const {
    appConfig,
    saveSuccess,
    saveConfig,
    addCustomPlatform,
    updateCustomPlatform,
    removeCustomPlatform,
    updateAppConfig,
  } = useConfig();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [importWarning, setImportWarning] = useState('');
  const [folderMessage, setFolderMessage] = useState('');
  const [showUploadCk, setShowUploadCk] = useState(false);
  const [showCloudreveApiKey, setShowCloudreveApiKey] = useState(false);

  const handleExport = () => {
    const blob = new Blob([serializeConfigForExport(appConfig)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = SAFE_CONFIG_EXPORT_FILENAME;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      setImportSuccess('');
      setImportError('配置文件过大，请选择 512KB 以内的 JSON 文件后重试。');
      event.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = async ev => {
      const result = await parseImportedConfigText(String(ev.target?.result ?? ''), appConfig);
      if (!result.ok) {
        setImportSuccess('');
        setImportWarning('');
        setImportError(result.error);
        return;
      }
      updateAppConfig(result.config);
      setImportError('');
      setImportSuccess(result.summary.message);
      setImportWarning(result.warnings.length > 0 ? result.warnings.join('\n') : '');
    };
    reader.onerror = () => {
      setImportSuccess('');
      setImportError('读取配置文件失败');
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await saveConfig();
    } catch (error) {
      setSaveError(getApiSafeMessage(error, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectDownloadPath = async () => {
    if (!window.electronAPI) {
      setFolderMessage('当前环境不支持选择本地目录，请在桌面客户端中使用。');
      return;
    }
    try {
      const result = await window.electronAPI.selectFolder();
      if (result.success && result.path) {
        updateAppConfig({ downloadPath: result.path });
        setFolderMessage('已选择自动下载目录；新提交任务会保存此目录快照。');
      }
    } catch (error) {
      setFolderMessage(`选择目录失败：${getApiSafeMessage(error, '未知错误')}`);
    }
  };

  const handleOpenDownloadPath = async () => {
    if (!appConfig.downloadPath) return;
    if (!window.electronAPI) {
      setFolderMessage('当前环境不支持打开本地目录，请在桌面客户端中使用。');
      return;
    }
    try {
      const result = await window.electronAPI.openPath(appConfig.downloadPath);
      setFolderMessage(result.success ? '已打开自动下载目录。' : (result.error || '打开目录失败'));
    } catch (error) {
      setFolderMessage(`打开目录失败：${getApiSafeMessage(error, '未知错误')}`);
    }
  };

  const handleClearSensitiveCredentials = () => {
    const confirmed = window.confirm(
      '确认清除本地保存的所有敏感凭据？\n\n将清除：内置平台 API Key、自定义平台 API Key、上传 Cookie（uploadCk）、Cloudreve ApiKey。\n不会删除平台、模型、参数覆盖、系统设置或任务历史。\n\n此操作不可恢复，清除后需要重新填写凭据。',
    );
    if (!confirmed) return;

    updateAppConfig({
      uploadCk: '',
      cloudreveApiKey: '',
      platforms: appConfig.platforms.map(platform => ({ ...platform, apiKey: '' })),
      customPlatforms: (appConfig.customPlatforms ?? []).map(platform => ({ ...platform, apiKey: '' })),
    });
    setImportError('');
    setSaveError('');
    setImportSuccess('已清除本地保存的所有平台 API Key、自定义平台 API Key、uploadCk 和 Cloudreve ApiKey；平台、模型、参数覆盖和任务历史均已保留。');
  };

  return (
    <div className="config-page page-shell">
      <div className="page-hero">
        <div>
          <h2>配置与模型</h2>
          <p>先配置 API Key，再按平台管理可用模型。火山方舟 / 豆包官方是同一套官方接口，只需要维护一套 Key；平台发布新模型后可在「模型管理」里手动添加。</p>
        </div>
        <div className="hero-actions flex items-center gap-2 flex-wrap">
          <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" />导出配置
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50" title="导入配置，敏感凭据需重新填写">
            <Upload className="w-3.5 h-3.5" />导入配置
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" />{saving ? '保存中...' : '保存'}
          </button>
          <input ref={fileInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImport} />
          {saveSuccess && <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-4 h-4" />已保存</span>}
        </div>
      </div>

      <div className="mb-4 flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium">敏感信息保护</p>
          <p className="text-xs mt-0.5">导出配置会自动剔除 API Key、上传 Cookie 等密钥；导入配置也不会恢复这些字段，请在对应平台卡片中重新填写。</p>
        </div>
        <button
          onClick={handleClearSensitiveCredentials}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-700 bg-white border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          title="仅清除本地敏感凭据，不删除平台、模型、参数覆盖或任务历史"
        >
          <Trash2 className="w-3.5 h-3.5" />清除敏感凭据
        </button>
      </div>

      {importSuccess && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          <CheckCircle className="w-4 h-4 flex-shrink-0" /><span>{importSuccess}</span>
          <button onClick={() => setImportSuccess('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {importError && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>{importError}</span>
          <button onClick={() => setImportError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {importWarning && (
        <div className="mb-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" /><span className="whitespace-pre-line">{importWarning}</span>
          <button onClick={() => setImportWarning('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}
      {saveError && (
        <div className="mb-4 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /><span>{saveError}</span>
          <button onClick={() => setSaveError('')} className="ml-auto"><X className="w-4 h-4" /></button>
        </div>
      )}


      <section className="config-platforms-section mb-6 border border-gray-200 rounded-xl bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">系统设置</h3>
        <div className="mb-4"><UpdatePanel /></div>
        <div className="config-settings-panel space-y-4">
          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-gray-700">自动下载视频</span>
                  <span className="text-xs leading-5 text-gray-500">开启后，新任务会保存当前下载目录快照，后续修改全局目录不影响既有任务。</span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={appConfig.autoDownload}
                onClick={() => updateAppConfig({ autoDownload: !appConfig.autoDownload })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${appConfig.autoDownload ? 'border-blue-200 bg-blue-500' : 'border-gray-200 bg-gray-200'}`}
                title={appConfig.autoDownload ? '关闭自动下载' : '开启自动下载'}
              >
                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${appConfig.autoDownload ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="text"
                value={appConfig.downloadPath ?? ''}
                onChange={e => updateAppConfig({ downloadPath: e.target.value })}
                placeholder="请选择自动下载目录"
                className="min-w-0 flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono bg-white"
              />
              <button onClick={handleSelectDownloadPath} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 bg-white border border-blue-100 rounded-lg hover:bg-blue-50">
                <FolderOpen className="w-3.5 h-3.5" />选择目录
              </button>
              <button onClick={handleOpenDownloadPath} disabled={!appConfig.downloadPath} className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                打开目录
              </button>
            </div>
            {appConfig.autoDownload && !appConfig.downloadPath && <p className="mt-2 text-xs text-red-500">请先选择下载目录，否则新任务不会启用自动下载。</p>}
            {folderMessage && <p className="mt-2 text-xs text-green-600">{folderMessage}</p>}
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-medium text-gray-700">使用系统代理</span>
                  <span className="text-xs leading-5 text-gray-500">关闭时强制直连，避免系统代理影响视频生成；开启后使用 Windows / 系统代理设置。</span>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={appConfig.useSystemProxy}
                onClick={() => updateAppConfig({ useSystemProxy: !appConfig.useSystemProxy })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-100 ${appConfig.useSystemProxy ? 'border-blue-200 bg-blue-500' : 'border-gray-200 bg-gray-200'}`}
                title={appConfig.useSystemProxy ? '关闭系统代理' : '开启系统代理'}
              >
                <span className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${appConfig.useSystemProxy ? 'translate-x-5' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <p className="system-proxy-note text-xs text-gray-500 bg-blue-50/70 border border-blue-100 rounded-lg px-2 py-1 mt-3">保存后会立即同步到桌面端网络会话；已提交或正在轮询的任务无需刷新或重新提交，后续轮询请求会使用新的网络设置。</p>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <label className="block text-xs font-medium text-gray-600 mb-1">手动 HTTP 代理（兼容旧配置）</label>
            <input
              type="text"
              value={appConfig.httpProxy ?? ''}
              onChange={e => updateAppConfig({ httpProxy: e.target.value })}
              placeholder="例如：http://127.0.0.1:7890"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
            />
            <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-2 py-1 mt-2">当前版本优先使用上方「使用系统代理」开关：关闭时直连，开启时读取系统代理。此字段仅保留用于兼容旧配置。</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">上传 Cookie（ck）</label>
            <div className="relative">
              <input
                type="password"
                autoComplete="off"
                value={(showUploadCk || !(appConfig.uploadCk ?? '')) ? (appConfig.uploadCk ?? '') : '•••••••••••••••••••••••'}
                readOnly={!showUploadCk && !!appConfig.uploadCk}
                onChange={e => updateAppConfig({ uploadCk: e.target.value })}
                placeholder="粘贴 GeekAI 登录后的 ck cookie 值..."
                className="w-full pr-12 px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
              <button
                type="button"
                onClick={() => setShowUploadCk(v => !v)}
                className="cookie-visibility-button absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                title={showUploadCk ? '隐藏 Cookie' : '显示 Cookie'}
                aria-label={showUploadCk ? '隐藏 Cookie' : '显示 Cookie'}
              >
                {showUploadCk ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-2">仅在某个平台的图片上传方式选择「GeekAI CDN」或上传视频/音频到 GeekAI 获取 URL 时使用。</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cloudreve ApiKey（密钥）</label>
            <div className="relative">
              <input
                type="password"
                autoComplete="new-password"
                value={(showCloudreveApiKey || !(appConfig.cloudreveApiKey ?? '')) ? (appConfig.cloudreveApiKey ?? '') : '•••••••••••••••••••••••'}
                readOnly={!showCloudreveApiKey && !!appConfig.cloudreveApiKey}
                onChange={e => updateAppConfig({ cloudreveApiKey: e.target.value })}
                placeholder="粘贴 Cloudreve 存储服务的 ApiKey..."
                className="w-full pr-12 px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
              <button
                type="button"
                onClick={() => setShowCloudreveApiKey(v => !v)}
                className="cookie-visibility-button absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                title={showCloudreveApiKey ? '隐藏 ApiKey' : '显示 ApiKey'}
                aria-label={showCloudreveApiKey ? '隐藏 ApiKey' : '显示 ApiKey'}
              >
                {showCloudreveApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-2">仅在某个平台的图片上传方式选择「云存储 Cloudreve」上传图片时使用。</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cloudreve 实例地址</label>
              <input
                type="text"
                value={appConfig.cloudreveBaseUrl ?? ''}
                onChange={e => updateAppConfig({ cloudreveBaseUrl: e.target.value })}
                placeholder="https://cloudreve.example.com"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">实例根地址，不含 /api/v4。</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">令牌服务地址</label>
              <input
                type="text"
                value={appConfig.cloudreveTokenServer ?? ''}
                onChange={e => updateAppConfig({ cloudreveTokenServer: e.target.value })}
                placeholder="https://cloudreve.example.com/t"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">用于用 ApiKey 换取 refresh_token。</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">远端上传目录</label>
              <input
                type="text"
                value={appConfig.cloudreveRemoteDir ?? ''}
                onChange={e => updateAppConfig({ cloudreveRemoteDir: e.target.value })}
                placeholder="cloudreve://my/图片"
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg font-mono"
              />
              <p className="mt-1 text-xs text-gray-500">例如 cloudreve://my/图片，不存在会自动创建。</p>
            </div>
          </div>
        </div>
      </section>
      
      <section className="config-platforms-section mb-6 border border-gray-200 rounded-xl bg-white p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">平台与模型</h3>
        <div className="space-y-3">
          {PLATFORM_DEFS.map(def => <BuiltinPlatformCard key={def.id} platformId={def.id} />)}
        </div>
      </section>

      <section className="config-platforms-section mb-6 border border-gray-200 rounded-xl bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">自定义平台 / 中转站</h3>
          <button onClick={() => addCustomPlatform(emptyPlatform())} className="new-platform-button flex items-center gap-1.5 px-3 py-1.5 text-xs text-white bg-orange-500 rounded-lg hover:bg-orange-600">
            <Plus className="w-3.5 h-3.5" />新增平台
          </button>
        </div>
        {(appConfig.customPlatforms ?? []).length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-white">
            <p className="text-sm text-gray-400">还没有自定义平台</p>
            <p className="text-xs text-gray-300 mt-1">点击「新增平台」对接任意兼容 API</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(appConfig.customPlatforms ?? []).map((platform, index) => (
              <CustomPlatformCard key={index} platform={platform} onUpdate={updates => updateCustomPlatform(platform.id, updates)} onRemove={() => removeCustomPlatform(platform.id)} />
            ))}
          </div>
        )}
      </section>

    </div>
  );
};

export default ConfigPage;
