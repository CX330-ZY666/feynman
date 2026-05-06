// src/components/VoiceRecorder.jsx
import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/axios';

import VolumeVisualizer from './VolumeVisualizer'; // 引入新的音量可视化组件

// 异步下载 RecordRTC
const getRecordRTC = async () => {
  try {
    const RecordRTC = (await import('recordrtc')).default;
    return RecordRTC;
  } catch (err) {
    console.error('RecordRTC 加载失败:', err);
    throw new Error('RecordRTC 加载失败：' + err.message);
  }
};

/**
 * VoiceRecorder 组件
 * 提供语音录制、播放、转文字功能
 * @param {Function} onTranscribeComplete - 转文字完成后的回调 (text) => void
 * @param {string} relatedId - 关联的知识点 ID（用于上传）
 * @param {string} transcribedText - 受控文本框内容（父组件管理）
 * @param {Function} onTextChange - 文本框变化回调
 */
function VoiceRecorder({ onTranscribeComplete, relatedId, transcribedText, onTextChange }) {
  const [status, setStatus] = useState('idle'); // idle, recording, paused
  const [seconds, setSeconds] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [volume, setVolume] = useState(0);
  const [mediaBlobUrl, setMediaBlobUrl] = useState('');
  
  // 转录方式与失败计数
  const [transcriptionMethod, setTranscriptionMethod] = useState('baidu');
  const [failureCount, setFailureCount] = useState(0);

  const timerRef = useRef(null);
  const recorderRef = useRef(null);
  const volumeRef = useRef(0);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const streamRef = useRef(null);

  // 计时器
  useEffect(() => {
    if (status === 'recording') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [status]);

  // 设置音量监听（使用已有的 stream）
  const setupVolumeMeter = (stream) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      analyserRef.current = analyser;
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const v = (dataArray[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / dataArray.length);
        const level = Math.min(1, rms * 3);
        volumeRef.current = level;
        setVolume(level);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      console.warn('音量监听初始化失败:', err?.message);
    }
  };

  const teardownVolumeMeter = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
    setVolume(0);
  };

  // 上传 Blob 进行语音识别
  const uploadBlob = async (audioBlob) => {
    setIsUploading(true);
    if (onTextChange) onTextChange(''); // 清空父组件文本
    try {
      const mime = audioBlob.type || 'audio/wav';
      const audioFile = new File([audioBlob], `voice-record-${relatedId}.wav`, { type: mime });

      const formData = new FormData();
      formData.append('audio', audioFile);
      formData.append('knowledgePointId', relatedId);
      formData.append('durationSeconds', String(seconds));
      formData.append('mimeType', mime);

      const endpoint = transcriptionMethod === 'whisper' ? '/audio/transcribe-local' : '/audio/transcribe';
      console.info(`[VoiceRecorder] 使用 ${transcriptionMethod === 'whisper' ? 'Whisper' : '百度API'} 进行转录 -> ${endpoint}`);
      const response = await apiClient.post(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const result =
        response.data?.result ||
        response.data?.text ||
        response.data?.transcription ||
        response.data?.DisplayText ||
        response.data?.results?.[0]?.alternatives?.[0]?.transcript ||
        '';
      const msg = response.data?.msg || response.data?.message || '';
      const text = result || msg || '转录结果为空，请稍后重试。';
      if (onTextChange) onTextChange(text); // 更新父组件文本

      // 成功则重置 Whisper 失败计数
      if (transcriptionMethod === 'whisper' && failureCount !== 0) {
        setFailureCount(0);
      }

      if (onTranscribeComplete) {
        onTranscribeComplete(text);
      }
    } catch (error) {
      const status = error?.response?.status;
      const suggestion = error?.response?.data?.suggestion || '';
      const isBackendOffline =
        !error?.response &&
        (error?.code === 'ERR_NETWORK' || String(error?.message || '').toLowerCase().includes('network'));

      const errorMsg = isBackendOffline
        ? '无法连接后端服务（localhost:3000），请先启动后端'
        :
        error?.response?.data?.msg ||
        error?.response?.data?.error ||
        error?.message ||
        '转录失败，请重试。';

      // Whisper下的自动降级逻辑
      if (transcriptionMethod === 'whisper' && (status === 503 || status === 504)) {
        const newCount = failureCount + 1;
        setFailureCount(newCount);
        if (newCount >= 3) {
          console.warn('Whisper 连续失败 3 次，自动切换到百度 API');
          setTranscriptionMethod('baidu');
          if (typeof window !== 'undefined') localStorage.setItem('transcriptionMethod', 'baidu');
          setFailureCount(0);
        }
      }

      const text = `转录失败: ${errorMsg}${suggestion ? `，建议：${suggestion}` : ''}`;
      if (onTextChange) onTextChange(text); // 更新父组件错误文本
      if (onTranscribeComplete) {
        onTranscribeComplete(text);
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleStart = async () => {
    setSeconds(0);
    try {
      // 此时动态加载 RecordRTC
      const RecordRTC = await getRecordRTC();
      if (!RecordRTC) {
        throw new Error('RecordRTC 模块暑未加载');
      }

      // 唯一一次 getUserMedia 调用
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      
      // 配置音量监听（使用为获取的 stream）
      setupVolumeMeter(stream);
      
      const recorder = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/wav',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
      });
      recorderRef.current = recorder;
      recorder.startRecording();
      setStatus('recording');
    } catch (err) {
      console.error('无法开始录音:', err);
      teardownVolumeMeter();
    }
  };

  const handleStop = () => {
    teardownVolumeMeter();
    if (!recorderRef.current) return;
    const recorder = recorderRef.current;
    recorder.stopRecording(async () => {
      try {
        const blob = recorder.getBlob();
        const url = URL.createObjectURL(blob);
        setMediaBlobUrl(url);
        setStatus('idle');
        await uploadBlob(blob);
      } catch (err) {
        console.error('停止录音失败:', err);
      } finally {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
        recorderRef.current = null;
      }
    });
  };

  const handlePause = () => {
    if (!recorderRef.current) return;
    try {
      recorderRef.current.pauseRecording();
      setStatus('paused');
    } catch (err) {
      console.warn('暂停失败:', err);
    }
  };

  const handleResume = () => {
    if (!recorderRef.current) return;
    try {
      recorderRef.current.resumeRecording();
      setStatus('recording');
    } catch (err) {
      console.warn('继续失败:', err);
    }
  };

  const handleClear = () => {
    if (onTextChange) onTextChange(''); // 清空父组件文本
    setMediaBlobUrl('');
    setSeconds(0);
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '6px', background: '#f9f9f9' }}>
      <h3>语音输入</h3>

      {/* 转录方式选择器 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.95rem', color: '#333' }}>转录方式：</span>
        <button
          onClick={() => { setTranscriptionMethod('whisper'); if (typeof window !== 'undefined') localStorage.setItem('transcriptionMethod', 'whisper'); setFailureCount(0); }}
          disabled={isUploading || status !== 'idle'}
          style={{ background: transcriptionMethod === 'whisper' ? '#2563eb' : '#e5e7eb', color: transcriptionMethod === 'whisper' ? '#fff' : '#111', border: 'none', borderRadius: 4, padding: '6px 10px' }}
        >
          🖥️ 本地 Whisper
        </button>
        <button
          onClick={() => { setTranscriptionMethod('baidu'); if (typeof window !== 'undefined') localStorage.setItem('transcriptionMethod', 'baidu'); setFailureCount(0); }}
          disabled={isUploading || status !== 'idle'}
          style={{ background: transcriptionMethod === 'baidu' ? '#2563eb' : '#e5e7eb', color: transcriptionMethod === 'baidu' ? '#fff' : '#111', border: 'none', borderRadius: 4, padding: '6px 10px' }}
        >
          ☁️ 百度 API
        </button>
        {transcriptionMethod === 'whisper' && failureCount > 0 && (
          <span style={{ color: '#d97706', marginLeft: 8 }}>⚠️ 本地 Whisper 已失败 {failureCount} 次，连续失败 3 次将自动切换至百度 API</span>
        )}
      </div>

      {/* 录音控制区 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={handleStart} disabled={status === 'recording'}>
          开始录音
        </button>
        <button onClick={handleStop} disabled={status !== 'recording' && status !== 'paused'}>
          停止录音
        </button>
        <button onClick={handlePause} disabled={status !== 'recording'}>
          暂停
        </button>
        <button onClick={handleResume} disabled={status !== 'paused'}>
          继续
        </button>
        <span style={{ color: '#555' }}>
          计时：{String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}
        </span>

        {/* 使用新的音量可视化组件 */}
        <VolumeVisualizer volume={volume} status={status} />
      </div>

      {mediaBlobUrl && (
        <div style={{ marginBottom: 12 }}>
          <label>录音回放：</label>
          <audio src={mediaBlobUrl} controls style={{ width: '100%' }} />
        </div>
      )}

      <div style={{ marginBottom: 12 }}>
        <label style={{ display: 'block', marginBottom: '6px', fontWeight: '600', color: '#374151' }}>
          📝 转录文本（可编辑）：
        </label>
        {isUploading && (
          <p style={{ color: '#666', fontSize: '0.9rem', margin: '8px 0' }}>
            {transcriptionMethod === 'whisper' ? '🖥️ 使用本地 Whisper 转录中...' : '☁️ 使用百度 API 转录中...'}
          </p>
        )}
        <textarea
          value={transcribedText || ''}
          onChange={(e) => onTextChange && onTextChange(e.target.value)}
          style={{ 
            width: '100%', 
            height: '140px', 
            padding: '12px', 
            fontFamily: 'inherit', 
            fontSize: '1rem',
            lineHeight: '1.6',
            border: '2px solid #d1d5db', 
            borderRadius: '8px',
            resize: 'vertical',
            transition: 'border-color 0.2s',
            outline: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
          onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          placeholder="转录结果将显示在这里，你可以随时编辑修正..."
        />
        {transcribedText && !isUploading && (
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '6px', marginBottom: 0 }}>
            ✨ 提示：请检查并修正转录错误，然后点击「提交 AI 评估」
          </p>
        )}
      </div>

      <button onClick={handleClear} style={{ background: '#999', color: '#fff', border: 'none', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer' }}>
        清空录音
      </button>
    </div>
  );
}

export default VoiceRecorder;
