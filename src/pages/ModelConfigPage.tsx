import React from 'react';

/**
 * ModelConfigPage — 已迁移
 * 参数配置现在直接内联在 modelTemplates.ts 的 ParamDef 里，
 * 用户覆盖在 ConfigPage 的「参数默认值覆盖」区域编辑。
 * 此页面保留占位，避免 App.tsx 路由报错。
 */
const ModelConfigPage: React.FC = () => (
  <div className="model-config-page page-shell rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-bold text-gray-800 mb-2">模型参数配置</h2>
    <p className="text-gray-500 text-sm">
      参数配置已整合进代码（modelTemplates.ts）。如需覆盖某个参数的默认值、禁用参数或自定义选项，
      请前往<strong>「配置」页</strong>，展开对应平台后点击「参数默认值覆盖」。
    </p>
  </div>
);

export default ModelConfigPage;
