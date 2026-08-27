---
*** Begin Patch
*** Update File: src/pages/GeneratePage.tsx
@@
-      const uploader = new CloudreveUploader(appConfig.cloudreveApiKey);
+      const uploader = new CloudreveUploader(appConfig.cloudreveApiKey, {
+        baseUrl: appConfig.cloudreveBaseUrl,
+        tokenServer: appConfig.cloudreveTokenServer,
+      });
*** End Patch
