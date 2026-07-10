import React, { useState } from 'react';
import { ExternalLink, RefreshCw } from 'lucide-react';

const UpdatePanel: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const check = async () => {
    if (!window.updateAPI) { setMessage('请在桌面客户端中检查更新。'); return; }
    setBusy(true);
    try {
      const info = await window.updateAPI.checkForUpdates();
      setUrl(info.url);
      setMessage(info.error || (info.version ? `发现版本 ${info.version}，可打开官方下载页。` : '未发现可用版本信息。'));
    } catch (error) { setMessage(error instanceof Error ? error.message : '检查更新失败'); }
    finally { setBusy(false); }
  };
  const open = async () => {
    if (!url || !window.updateAPI) return;
    setBusy(true);
    try { await window.updateAPI.openDownload(url); setMessage('已打开官方下载页。'); }
    catch (error) { setMessage(error instanceof Error ? error.message : '打开下载页失败'); }
    finally { setBusy(false); }
  };
  return <div className="update-panel rounded-lg border border-violet-100 bg-violet-50/60 p-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="update-panel__title text-sm font-medium text-gray-800">应用更新</p><p className="update-panel__description text-xs text-gray-500">通过 HTTPS 检查版本并打开官方发布页。</p></div><div className="flex gap-2"><button type="button" onClick={check} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs text-violet-700 hover:bg-violet-100"><RefreshCw className="h-3.5 w-3.5" />检查更新</button>{url && <button type="button" onClick={open} disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-1.5 text-xs text-white hover:bg-violet-700"><ExternalLink className="h-3.5 w-3.5" />打开下载页</button>}</div></div>
    {message && <p className="update-panel__message mt-2 text-xs text-violet-700">{message}</p>}
  </div>;
};
export default UpdatePanel;
