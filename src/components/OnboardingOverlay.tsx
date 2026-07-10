import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

type Props = { onNavigate: (tab: string) => void };
const STEPS = [
  { title: '欢迎使用 AIVideoForge', body: '这是一个多平台 AI 视频生成工作台。下面用三步完成首次使用。', tab: 'generate' },
  { title: '配置平台与模型', body: '先到系统配置填写平台 API Key，并确认可用模型。', tab: 'config' },
  { title: '填写 Prompt 并提交', body: '回到视频生成页选择模式、模型和参数，填写 Prompt 后提交任务。', tab: 'generate' },
  { title: '追踪结果与下载', body: '在任务管理页查看状态、播放结果、下载视频或复用参数。', tab: 'tasks' },
];
const OnboardingOverlay: React.FC<Props> = ({ onNavigate }) => {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(() => localStorage.getItem('aivideoforge_onboarding_done') !== '1');
  useEffect(() => { const open = () => { setIndex(0); setVisible(true); }; window.addEventListener('aivideoforge:open-onboarding', open); return () => window.removeEventListener('aivideoforge:open-onboarding', open); }, []);
  if (!visible) return null;
  const close = () => { localStorage.setItem('aivideoforge_onboarding_done', '1'); setVisible(false); };
  const step = STEPS[index];
  return <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title"><div className="onboarding-dialog"><div className="onboarding-header"><div><p className="onboarding-progress-label">快速上手 {index + 1}/{STEPS.length}</p><h2 id="onboarding-title" className="onboarding-title">{step.title}</h2></div><button type="button" onClick={close} className="onboarding-icon-button" aria-label="关闭引导"><X aria-hidden="true" /></button></div><p className="onboarding-body">{step.body}</p><div className="onboarding-progress" role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={index + 1} aria-label={`第 ${index + 1} 步，共 ${STEPS.length} 步`}>{STEPS.map((item, i) => <span key={item.title} className={`onboarding-progress-segment${i <= index ? ' is-complete' : ''}`} />)}</div><div className="onboarding-actions"><button type="button" onClick={close} className="onboarding-button onboarding-button--secondary">跳过</button><div className="onboarding-navigation">{index > 0 && <button type="button" onClick={() => setIndex(v => v - 1)} className="onboarding-button onboarding-button--secondary"><ChevronLeft aria-hidden="true" />上一步</button>}<button type="button" onClick={() => { onNavigate(step.tab); if (index === STEPS.length - 1) close(); else setIndex(v => v + 1); }} className="onboarding-button onboarding-button--primary">{index === STEPS.length - 1 ? '开始使用' : '下一步'}{index < STEPS.length - 1 && <ChevronRight aria-hidden="true" />}</button></div></div></div></div>;
};
export default OnboardingOverlay;
