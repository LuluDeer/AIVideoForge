---
*** Begin Patch
*** Update File: src/types/index.ts
@@
-export type ImageUploadMode = 'geekai' | 'base64' | 'url' | 'cloudreve';
+export type ImageUploadMode = 'geekai' | 'base64' | 'url' | 'cloudreve';
@@
   httpProxy: string;
   uploadCk: string;
+  /** Cloudreve 存储服务 ApiKey，用于「上传到 Cloudreve」图传方式 */
+  cloudreveApiKey: string;
+  /** Cloudreve API 基础地址（示例：不填默认禁用，需在配置页填写） */
+  cloudreveBaseUrl?: string;
+  /** Cloudreve Token 服务地址（用于 api_key -> refresh_token 交换） */
+  cloudreveTokenServer?: string;
*** End Patch
