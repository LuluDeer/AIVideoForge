import React, { useState, useCallback } from 'react';
import { Video, Image, Upload, Play, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useConfig } from '../context/ConfigContext';
import { useTasks } from '../context/TaskContext';
import type { GenerationMode, ImageFile, VideoGenerationRequest } from '../types';
import GeekaiApi from '../services/api';
import ImageUploader from '../services/imageUpload';

const GeneratePage: React.FC = () => {
  const { config } = useConfig();
  const { addTask, updateTask } = useTasks();
  const [mode, setMode] = useState<GenerationMode>('text');
  const [promptList, setPromptList] = useState<string[]>(['']);
  const [generationCount, setGenerationCount] = useState<number>(1);
  const [images, setImages] = useState<ImageFile[]>([]);
  const [tailImage, setTailImage] = useState<ImageFile | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const modes: { value: GenerationMode; label: string; icon: React.ReactNode }[] = [
    { value: 'text', label: '文生视频', icon: <Video className="w-4 h-4" /> },
    { value: 'image', label: '图生视频', icon: <Image className="w-4 h-4" /> },
    { value: 'imageTail', label: '首尾帧', icon: <Image className="w-4 h-4" /> },
    { value: 'multiImage', label: '多图生成', icon: <Image className="w-4 h-4" /> },
  ];

  const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    console.log('config.ck value:', config.ck ? `[SET, length: ${config.ck.length}]` : '[EMPTY]');
    console.log('config.ck preview:', config.ck?.substring(0, 100));
    
    if (!config.ck) {
      setError('请先在配置页面设置Cookie (CK)');
      return;
    }

    const uploader = new ImageUploader(config.ck);
    const newImages: ImageFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const result = await uploader.uploadImage(file);
        newImages.push({
          file,
          url: result.url,
          name: file.name,
        });
      } catch (err) {
        console.error('上传失败:', err);
        setError(`图片上传失败: ${(err as Error).message}`);
      }
    }

    if (mode === 'imageTail' && !tailImage) {
      setTailImage(newImages[0]);
    } else {
      setImages(prev => [...prev, ...newImages]);
    }
    e.target.value = '';
  }, [config.ck, mode, tailImage]);

  const handleRemoveImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveTailImage = () => {
    setTailImage(null);
  };

  const handleAddPrompt = () => {
    setPromptList([...promptList, '']);
  };

  const handleRemovePrompt = (index: number) => {
    if (promptList.length > 1) {
      setPromptList(promptList.filter((_, i) => i !== index));
    }
  };

  const handleUpdatePrompt = (index: number, value: string) => {
    const newList = [...promptList];
    newList[index] = value;
    setPromptList(newList);
  };

  const handleGenerate = async () => {
    if (!config.apiKey) {
      setError('请先配置API Key');
      return;
    }

    const validPrompts = promptList.filter(p => p.trim());
    if (validPrompts.length === 0) {
      setError('请输入至少一个Prompt');
      return;
    }

    if ((mode === 'image' || mode === 'imageTail' || mode === 'multiImage') && images.length === 0) {
      setError('请上传至少一张图片');
      return;
    }

    if (mode === 'imageTail' && !tailImage) {
      setError('请上传尾帧图片');
      return;
    }

    setIsGenerating(true);
    setError('');

    const api = new GeekaiApi(config.apiKey);

    for (const prompt of validPrompts) {
      for (let i = 0; i < generationCount; i++) {
        try {
          const request: VideoGenerationRequest = {
            model: config.defaultModel,
            prompt: prompt.trim(),
            async: true,
            aspect_ratio: config.aspectRatio,
            resolution: config.resolution,
            duration: config.duration,
          };

          if (mode === 'image' && images[0]?.url) {
            request.image = images[0].url;
          } else if (mode === 'imageTail' && images[0]?.url && tailImage?.url) {
            request.image = images[0].url;
            request.image_tail = tailImage.url;
          } else if (mode === 'multiImage') {
            request.image = images.map(img => img.url).filter(Boolean) as string[];
          }

          const response = await api.generateVideo(request);
          
          const task = addTask({
            id: response.task_id,
            prompt: prompt.trim(),
            model: config.defaultModel,
            mode,
            count: generationCount,
            image_url: typeof request.image === 'string' ? request.image : undefined,
            image_tail_url: request.image_tail,
            image_urls: Array.isArray(request.image) ? request.image : undefined,
            status: response.task_status,
            video_url: response.video_result?.[0]?.url,
            auto_download: config.autoDownload && !!config.downloadPath,
            downloaded: false,
          });

          if (response.task_status === 'running') {
            const pollTask = async () => {
              try {
                const result = await api.waitForTask(response.task_id);
                const videoUrl = result.video_result?.[0]?.url;
                updateTask(task.id, {
                  status: result.task_status,
                  video_url: videoUrl,
                  updated_at: Date.now(),
                });

                if (result.task_status === 'succeed' && videoUrl && config.autoDownload && config.downloadPath) {
                  if ((window as any).electronAPI) {
                    try {
                      await (window as any).electronAPI.downloadFile(videoUrl, config.downloadPath);
                      updateTask(task.id, { downloaded: true });
                      console.log(`视频 ${task.id} 已自动下载到: ${config.downloadPath}`);
                    } catch (downloadErr) {
                      console.error('自动下载失败:', downloadErr);
                    }
                  }
                }
              } catch (err) {
                updateTask(task.id, { status: 'failed', updated_at: Date.now() });
                console.error('任务轮询失败:', err);
              }
            };
            pollTask();
          }
        } catch (err) {
          console.error('生成失败:', err);
          setError(`生成失败: ${(err as Error).message}`);
        }
      }
    }

    setIsGenerating(false);
    const createdTasks = validPrompts.length * generationCount;
    setSuccessMessage(`成功创建 ${createdTasks} 个任务，正在后台生成中...`);
    setTimeout(() => setSuccessMessage(''), 5000);
    setPromptList(['']);
    setImages([]);
    setTailImage(null);
  };

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">视频生成</h2>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {successMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">生成模式</h3>
            <div className="grid grid-cols-4 gap-3">
              {modes.map(m => (
                <button
                  key={m.value}
                  onClick={() => {
                    setMode(m.value);
                    setImages([]);
                    setTailImage(null);
                  }}
                  className={`flex flex-col items-center gap-2 px-4 py-4 rounded-lg border-2 transition-all ${
                    mode === m.value
                      ? 'border-blue-500 bg-blue-50 text-blue-600'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  {m.icon}
                  <span className="text-sm font-medium">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-700 mb-4">
              生成参数
              <span className="text-sm font-normal text-gray-400 ml-2">
                ({mode === 'text' ? '文生视频' : '图生视频'})
              </span>
            </h3>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">模型</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                  {config.defaultModel}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">宽高比</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                  {config.aspectRatio}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">分辨率</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                  {config.resolution}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">视频时长</label>
                <div className="px-3 py-2 bg-gray-100 rounded-lg text-sm text-gray-700">
                  {config.duration}秒
                </div>
              </div>
            </div>
          </div>

          {(mode === 'image' || mode === 'imageTail' || mode === 'multiImage') && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                {mode === 'imageTail' ? '首帧图片' : '参考图片'}
                <span className="text-sm font-normal text-gray-400 ml-2">
                  ({mode === 'multiImage' ? '最多3张' : '1张'})
                </span>
              </h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                  multiple={mode === 'multiImage'}
                />
                <label
                  htmlFor="image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2 text-gray-500 hover:text-blue-600"
                >
                  <Upload className="w-10 h-10" />
                  <span>点击或拖拽上传图片</span>
                </label>
              </div>
              {images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {images.map((img, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={img.url || URL.createObjectURL(img.file)}
                        alt={img.name}
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <p className="text-sm text-gray-500 mt-1 truncate">{img.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === 'imageTail' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-4">尾帧图片</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="tail-image-upload"
                />
                <label
                  htmlFor="tail-image-upload"
                  className="cursor-pointer flex flex-col items-center gap-2 text-gray-500 hover:text-blue-600"
                >
                  <Upload className="w-10 h-10" />
                  <span>点击或拖拽上传尾帧图片</span>
                </label>
              </div>
              {tailImage && (
                <div className="mt-4">
                  <div className="relative inline-block">
                    <img
                      src={tailImage.url || URL.createObjectURL(tailImage.file)}
                      alt={tailImage.name}
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <button
                      onClick={handleRemoveTailImage}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">{tailImage.name}</p>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-700">
                  Prompt列表
                  <span className="text-sm font-normal text-gray-400 ml-2">
                    (点击添加多个Prompt，支持包含换行符)
                  </span>
                </h3>
                <button
                  onClick={handleAddPrompt}
                  className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  添加Prompt
                </button>
              </div>
              <div className="space-y-3">
                {promptList.map((prompt, index) => (
                  <div key={index} className="relative group">
                    <textarea
                      value={prompt}
                      onChange={(e) => handleUpdatePrompt(index, e.target.value)}
                      className="w-full min-h-[80px] px-4 py-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y font-mono text-sm"
                      placeholder={`输入第 ${index + 1} 个Prompt...`}
                    />
                    {promptList.length > 1 && (
                      <button
                        onClick={() => handleRemovePrompt(index)}
                        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="删除此Prompt"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                <span>
                  {promptList.filter(p => p.trim()).length} 个任务 x {generationCount} 次 = {promptList.filter(p => p.trim()).length * generationCount} 个任务待生成
                </span>
                <button
                  onClick={() => setPromptList([''])}
                  className="text-red-500 hover:text-red-600"
                >
                  清空全部
                </button>
              </div>
            </div>
            <div className="w-48">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">生成次数</h3>
              <input
                type="number"
                min="1"
                max="10"
                value={generationCount}
                onChange={(e) => setGenerationCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
              <p className="text-sm text-gray-500 mt-2">每个Prompt生成次数</p>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full py-4 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                正在生成...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                开始生成 ({promptList.filter(p => p.trim()).length} 个任务)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GeneratePage;
