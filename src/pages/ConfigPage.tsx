import React from 'react';
import { Save, RotateCcw, AlertCircle, CheckCircle, FolderOpen } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import type { Config } from '../types';

const ConfigPage: React.FC = () => {
  const { config, updateConfig, saveConfig, loadConfig, saveSuccess } = useConfig();

  const handleChange = (key: keyof Config, value: string | number | boolean) => {
    updateConfig({ [key]: value });
  };

  const handleSelectDownloadPath = async () => {
    if ((window as any).electronAPI) {
      const result = await (window as any).electronAPI.selectFolder();
      if (result && result.path) {
        updateConfig({ downloadPath: result.path });
      }
    } else {
      alert('请在桌面应用中使用此功能');
    }
  };

  const models = [
    { value: 'veo-3.1-lite-generate-preview', name: 'Veo 3.1 Lite Preview', label: 'Veo 3.1 Lite Preview' },
    { value: 'veo-3.1-fast-generate-preview', name: 'Veo 3.1 Fast Preview', label: 'Veo 3.1 Fast Preview (推荐)' },
    { value: 'veo-3.1-generate-preview', name: 'Veo 3.1 Preview', label: 'Veo 3.1 Preview' },
    { value: 'veo-3.0-fast-generate-001', name: 'Veo 3 快速版', label: 'Veo 3 快速版' },
    { value: 'veo-3.0-generate-001', name: 'Veo 3', label: 'Veo 3' },
    { value: 'veo-2.0-generate-001', name: 'Veo 2', label: 'Veo 2' },
    { value: 'cogvideox-flash', name: 'CogVideoX Flash', label: 'CogVideoX Flash (文生视频)' },
    { value: 'kling-v1-6', name: 'Kling V1.6', label: 'Kling V1.6 (图生视频)' },
  ];

  const aspectRatios = [
    { value: '16:9', label: '横屏 16:9' },
    { value: '9:16', label: '竖屏 9:16' },
  ];

  const resolutions = [
    { value: '720p', label: '标清 720p' },
    { value: '1080p', label: '高清 1080p' },
    { value: '4k', label: '超清 4K' },
  ];

  const durations = [4, 6, 8];

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">系统配置</h2>
        <div className="flex gap-3 items-center">
          {saveSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 text-green-600 bg-green-100 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              保存成功
            </div>
          )}
          <button
            onClick={loadConfig}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置
          </button>
          <button
            onClick={saveConfig}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            保存配置
          </button>
        </div>
      </div>

        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">API配置</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GeekAI API Key</label>
                <input
                  type="password"
                  value={config.apiKey}
                  onChange={(e) => handleChange('apiKey', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="请输入API Key"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cookie (CK)</label>
                <input
                  type="text"
                  value={config.ck}
                  onChange={(e) => handleChange('ck', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="请输入Cookie用于图片上传"
                />
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">默认参数</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">默认模型</label>
                <div className="grid grid-cols-2 gap-3">
                  {models.map(model => (
                    <button
                      key={model.value}
                      onClick={() => handleChange('defaultModel', model.value)}
                      className={`p-4 rounded-lg border-2 transition-all text-left ${
                        config.defaultModel === model.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-base font-semibold text-gray-800">{model.name}</div>
                      <div className="text-xs text-gray-500 mt-1 font-mono">{model.value}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">宽高比</label>
                  <select
                    value={config.aspectRatio}
                    onChange={(e) => handleChange('aspectRatio', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {aspectRatios.map(ratio => (
                      <option key={ratio.value} value={ratio.value}>{ratio.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">分辨率</label>
                  <select
                    value={config.resolution}
                    onChange={(e) => handleChange('resolution', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    {resolutions.map(res => (
                      <option key={res.value} value={res.value}>{res.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">视频时长 (秒)</label>
                <div className="flex gap-2">
                  {durations.map(duration => (
                    <button
                      key={duration}
                      onClick={() => handleChange('duration', duration)}
                      className={`px-4 py-2 rounded-lg border transition-colors ${
                        config.duration === duration
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {duration}秒
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">下载设置</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">下载路径</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={config.downloadPath}
                    onChange={(e) => handleChange('downloadPath', e.target.value)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    placeholder="点击右侧按钮选择下载路径"
                    readOnly
                  />
                  <button
                    onClick={handleSelectDownloadPath}
                    className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <FolderOpen className="w-4 h-4" />
                    选择
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-700">自动下载</div>
                  <div className="text-xs text-gray-500 mt-1">开启后，视频生成成功将自动下载到指定路径</div>
                </div>
                <button
                  onClick={() => handleChange('autoDownload', !config.autoDownload)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    config.autoDownload ? 'bg-blue-600' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`absolute top-1 right-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      config.autoDownload ? 'translate-x-0' : '-translate-x-6'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">注意事项</p>
                <ul className="mt-2 space-y-1 list-disc list-inside text-amber-700">
                  <li>API Key用于视频生成接口认证</li>
                  <li>CK用于图片上传接口认证</li>
                  <li>配置修改后需点击"保存配置"生效</li>
                  <li>4K分辨率仅Veo 3.1和Veo 3.1 Fast支持</li>
                  <li>自动下载需先设置下载路径</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfigPage;
