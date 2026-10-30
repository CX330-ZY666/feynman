import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/axios';
import AppIcon from './ui/AppIconFixed';

// Dedicated to chat: returns an editable draft, never sends an AI message itself.
export default function PracticeVoiceInput({ relatedId, disabled, onText, onBusy }) {
  const [phase, setPhase] = useState('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const runtime = useRef({ generation: 0, recorder: null, stream: null, timer: null, controller: null, blob: null, busy: false, uploading: false, stopping: false });
  const stopRef = useRef(null);
  const startRef = useRef(null);
  useEffect(() => {
    const timer = setTimeout(() => startRef.current?.(), 0);
    return () => clearTimeout(timer);
  }, []);
  const callbacks = useRef({ onText, onBusy });
  useEffect(() => { callbacks.current = { onText, onBusy }; }, [onText, onBusy]);
  const release = () => {
    const r = runtime.current;
    clearInterval(r.timer); r.stream?.getTracks().forEach(track => track.stop());
    r.stream = null; r.recorder?.destroy(); r.recorder = null;
  };
  useEffect(() => () => {
    runtime.current.generation++; runtime.current.controller?.abort(); release();
  }, []);
  const cancel = () => {
    runtime.current.generation++; runtime.current.controller?.abort(); release();
    runtime.current.blob = null; setPhase('idle'); setError(''); callbacks.current.onBusy(false);
    runtime.current.busy = false; runtime.current.uploading = false; runtime.current.stopping = false;
  };
  const transcribe = async (blob, generation) => {
    if (runtime.current.uploading) return;
    runtime.current.uploading = true; runtime.current.busy = true;
    setPhase('transcribing'); setError(''); callbacks.current.onBusy(true);
    const controller = new AbortController(); runtime.current.controller = controller;
    try {
      const data = new FormData(); data.append('audio', blob, 'practice.wav'); data.append('knowledgePointId', relatedId);
      const response = await apiClient.post('/audio/transcribe', data, { headers: { 'Content-Type': undefined }, signal: controller.signal, timeout: 65000 });
      if (generation !== runtime.current.generation) return;
      const text = String(response.data?.result || response.data?.text || response.data?.transcription || '').trim();
      if (!text) throw new Error('没有识别到有效文字，请重新录音或使用文字输入');
      runtime.current.blob = null; setPhase('idle'); callbacks.current.onBusy(false);
      runtime.current.busy = false; runtime.current.uploading = false;
      callbacks.current.onText(text);
    } catch (err) {
      if (generation !== runtime.current.generation) return;
      setError(err.response?.data?.msg || err.message || '语音转写失败'); setPhase('idle'); callbacks.current.onBusy(false);
      runtime.current.busy = false; runtime.current.uploading = false;
    }
  };
  const stop = () => {
    if (phase !== 'recording' || !runtime.current.recorder || runtime.current.stopping) return;
    runtime.current.stopping = true;
    setPhase('transcribing'); clearInterval(runtime.current.timer);
    const generation = runtime.current.generation;
    const recorder = runtime.current.recorder;
    recorder.stopRecording(() => {
      if (generation !== runtime.current.generation) return;
      const blob = recorder.getBlob(); runtime.current.blob = blob; release();
      if (!blob?.size) { setError('录音为空，请重试'); setPhase('idle'); callbacks.current.onBusy(false); runtime.current.busy = false; return; }
      transcribe(blob, generation);
    });
  };
  stopRef.current = stop;
  const start = async () => {
    if (disabled || phase !== 'idle' || runtime.current.busy) return;
    runtime.current.busy = true; runtime.current.stopping = false;
    const generation = ++runtime.current.generation;
    setPhase('starting'); setError(''); setSeconds(0); callbacks.current.onBusy(true);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器无法录音，请使用 HTTPS 并允许麦克风权限');
      const RecordRTC = (await import('recordrtc')).default;
      if (generation !== runtime.current.generation) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
      if (generation !== runtime.current.generation) { stream.getTracks().forEach(t => t.stop()); return; }
      runtime.current.stream = stream;
      const recorder = new RecordRTC(stream, { type: 'audio', mimeType: 'audio/wav', recorderType: RecordRTC.StereoAudioRecorder, desiredSampRate: 16000, numberOfAudioChannels: 1 });
      runtime.current.recorder = recorder; recorder.startRecording(); setPhase('recording');
      let elapsed = 0;
      runtime.current.timer = setInterval(() => { elapsed++; setSeconds(elapsed); if (elapsed >= 60) stopRef.current?.(); }, 1000);
    } catch (err) {
      if (generation !== runtime.current.generation) return;
      release(); setPhase('idle'); setError(err.name === 'NotAllowedError' ? '麦克风权限被拒绝，请允许录音或使用文字输入' : err.message); callbacks.current.onBusy(false);
      runtime.current.busy = false;
    }
  };
  startRef.current = start;
  return <div className="pc-voice">
    <div className="pc-voice-controls">
      {phase === 'idle' ? <button type="button" onClick={start} disabled={disabled}><AppIcon name="microphone" />开始录音</button> : <>
        <span role="status">{phase === 'starting' ? '正在申请麦克风权限…' : phase === 'transcribing' ? '正在转写，成功后填入输入框…' : `正在录音 ${seconds}s / 60s`}</span>
        {phase === 'recording' && <button type="button" onClick={stop}>结束录音</button>}
        <button type="button" onClick={cancel}>取消</button>
      </>}
      {phase === 'idle' && error && runtime.current.blob && <button type="button" disabled={disabled} onClick={() => { if (!runtime.current.uploading) transcribe(runtime.current.blob, ++runtime.current.generation); }}>重试转写</button>}
    </div>
    {error && <p role="alert" className="pc-error">{error}</p>}
    <small>结束录音后转写到输入框，可修改后发送；每段最长60秒。</small>
  </div>;
}
