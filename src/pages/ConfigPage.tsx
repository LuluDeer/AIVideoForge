@@
           <div>
             <label className="block text-xs font-medium text-gray-600 mb-1">Cloudreve ApiKey（密钥）</label>
             <div className="relative">
               <input
                 type="text"
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
+          <div className="grid grid-cols-1 gap-2 mt-3">
+            <div>
+              <label className="block text-xs font-medium text-gray-600 mb-1">Cloudreve API 基础地址（Base URL）</label>
+              <input
+                type="text"
+                value={appConfig.cloudreveBaseUrl ?? ''}
+                onChange={e => updateAppConfig({ cloudreveBaseUrl: e.target.value })}
+                placeholder="例如：https://cloudreve.example.com（必填以启用 Cloudreve）"
+                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
+              />
+              <p className="text-xs text-gray-500 mt-1">若使用 Cloudreve 上传，请填写实例的 API 基础地址；留空则 Cloudreve 功能不可用。</p>
+            </div>
+            <div>
+              <label className="block text-xs font-medium text-gray-600 mb-1">Cloudreve Token 服务地址（Token Server）</label>
+              <input
+                type="text"
+                value={appConfig.cloudreveTokenServer ?? ''}
+                onChange={e => updateAppConfig({ cloudreveTokenServer: e.target.value })}
+                placeholder="例如：https://cloudreve.example.com/t（用于 api_key -> refresh_token）"
+                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg"
+              />
+              <p className="text-xs text-gray-500 mt-1">用于通过本地 api_key 换取 refresh_token 的服务地址；通常与 Base URL 同属一域名并带 /t 路径。</p>
+            </div>
+          </div>
*** End Patch
