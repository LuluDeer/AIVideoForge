## 实施计划：新增“是否使用系统代理”开关

### 当前问题判断
- 项目是 React + TypeScript + Electron 桌面应用。
- 配置页已有 `HTTP代理` 输入框和 `appConfig.httpProxy` 字段，但 `electron/main.ts` 没有实现 `set-http-proxy-config` IPC handler，也没有调用 `session.defaultSession.setProxy(...)`。
- 因此当前代理配置实际没有完整落地；同时 Electron/Chromium 默认可能读取系统代理，用户开着系统代理时生成视频可能被代理影响。

### 目标行为
- 在「配置与模型」→「系统设置」里新增一个开关：`使用系统代理`。
- 默认关闭：应用网络请求走直连，不使用系统代理。
- 开启：应用使用操作系统当前代理设置。
- 保存后立即通过 Electron `session.defaultSession.setProxy(...)` 生效；为稳妥会提示必要时重启/重新提交任务。

### 计划修改文件

1. `src/types/index.ts`
   - 在 `AppConfig` 中新增：
     - `useSystemProxy: boolean`
   - 保留现有 `httpProxy` 字段以兼容旧配置，不强删。

2. `src/services/configSchema.ts`
   - `DEFAULT_APP_CONFIG` 增加 `useSystemProxy: false`。
   - `normalizeAppConfig` 增加布尔字段归一化。
   - `migrateLegacyConfig` 迁移时保留旧 `httpProxy`；如果旧配置里有手动 `httpProxy`，不自动开启系统代理，避免改变默认“直连”语义。

3. `src/pages/ConfigPage.tsx`
   - 在系统设置中新增开关卡片 `使用系统代理`。
   - 关闭文案：`关闭时强制直连，避免系统代理影响视频生成。`
   - 开启文案：`开启后使用 Windows/系统代理设置。`
   - 现有 `HTTP代理` 输入框可保留为兼容/高级字段，但我会调整提示，避免用户误以为它就是系统代理开关；保存时主逻辑优先按 `useSystemProxy` 走 `system/direct`。

4. `src/context/ConfigContext.tsx`
   - `saveConfig()` 调用 Electron IPC 时改为传入新配置：`useSystemProxy` 与 `httpProxy`。
   - 如果没有 Electron 环境，仍只保存本地配置。

5. `electron/preload.js` 与 `src/types/electron.ts`
   - 将 `setHttpProxyConfig` 参数类型从纯字符串扩展为对象，例如：
     - `{ useSystemProxy: boolean; httpProxy?: string }`
   - 保持方法名不变，减少调用链改动。

6. `electron/main.ts`
   - 新增 `ipcMain.handle('set-http-proxy-config', ...)`。
   - 当 `useSystemProxy === true`：调用 `session.defaultSession.setProxy({ mode: 'system' })`。
   - 当 `useSystemProxy === false`：调用 `session.defaultSession.setProxy({ mode: 'direct' })`。
   - 如果后续要兼容现有手动代理字段，可在高级逻辑中支持 `fixed_servers`，但本次主目标以系统代理开关为准。
   - 在 `app.whenReady()` 后创建窗口前/配置保存时都能应用代理；首次启动时配置需要 renderer 初始化后保存或自动调用，若代码中读取配置后未自动调用，我会补一个初始化同步，让默认直连尽早生效。

7. 验证
   - 运行 `npm run build` 检查 TypeScript 与 Vite 构建。
   - 如时间允许运行 `npm run test`。

### 预期效果
- 开关关闭时，即使 Windows 系统代理开着，Electron session 也会使用直连，视频生成请求不再被系统代理干扰。
- 开关开启时，Electron session 会使用系统代理，适合需要代理访问的平台。
- 配置会持久保存，下次启动仍按选择生效。