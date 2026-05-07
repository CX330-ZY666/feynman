// src/pages/FeynmanRecordPage.jsx
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/axios';
import VoiceRecorder from '../components/VoiceRecorder';
import StagedEvaluationResult from '../components/StagedEvaluationResult';
import './FeynmanRecordPage.css';

function FeynmanRecordPage() {
  const { id } = useParams();
  const [kpTitle, setKpTitle] = useState('');
  const [loadError, setLoadError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // 此状态用于从子组件接收转录文本
  const [transcribedText, setTranscribedText] = useState('');
  // 记录本次创建的 Attempt ID，用于回写AI结果
  const [attemptId, setAttemptId] = useState(null);
  
  // 🆕 AI评价相关状态
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState('');
  const [originalContent, setOriginalContent] = useState(''); // 保存原始知识点内容
  const [stagedResult, setStagedResult] = useState(null); // 三阶段评估结果

  // 分开保存的选项与状态
  const [isSavingAttempt, setIsSavingAttempt] = useState(false);
  const [saveAttemptMsg, setSaveAttemptMsg] = useState('');

  useEffect(() => {
    const fetchKpTitle = async () => {
      try {
        const response = await apiClient.get(`/knowledge-points/${id}`);
        setKpTitle(response.data?.title || '');
        setOriginalContent(response.data?.content || ''); // 🆕 同时保存原始内容
      } catch (err) {
        console.warn('加载知识点失败:', err);
        setLoadError('加载知识点失败');
      }
    };
    fetchKpTitle();
  }, [id]);

  // 三阶段评估
  const getStagedEvaluation = async (transcribed) => {
    setIsEvaluating(true);
    setStagedResult(null);
    setEvaluationError('');

    try {
      const response = await apiClient.post('/ai/evaluate-staged', {
        knowledgePointId: id,
        transcribedText: transcribed
      }, { timeout: 60000 });

      setStagedResult(response.data);

      // 根据分数自动更新复习状态
      if (response.data.finalScore < 60) {
        await apiClient.put(`/knowledge-points/${id}/review`, { reviewList: true });
      } else {
        await apiClient.put(`/knowledge-points/${id}/review`, { reviewList: false });
      }
    } catch (error) {
      console.error('三阶段评估失败:', error);
      setEvaluationError(`评估失败: ${error?.response?.data?.msg || error.message}`);
    } finally {
      setIsEvaluating(false);
    }
  };

  // 转录完成后的回调
  const handleTranscribeComplete = (text) => {
    setTranscribedText(text);
  };

  // 保存评估结果
  const handleSaveAttempt = async () => {
    if (!stagedResult) return;
    setIsSavingAttempt(true);
    setSaveAttemptMsg('');
    try {
      const payload = {
        knowledgePointId: id,
        score: stagedResult.finalScore,
        transcribedText,
        feedback: `覆盖率: ${stagedResult.breakdown.coverage}%, 逻辑: ${stagedResult.breakdown.logic}分, 准确性: ${stagedResult.breakdown.accuracy}%`,
        standardAnswer: originalContent
      };

      const resp = await apiClient.post('/attempts', payload);
      const createdId = resp.data?.id || resp.data?._id;
      setAttemptId(createdId || null);
      setSaveAttemptMsg('✅ 已保存本次复述/评价结果');
    } catch (e) {
      setSaveAttemptMsg(`❌ 保存失败：${e?.response?.data?.msg || e?.message || '未知错误'}`);
    } finally {
      setIsSavingAttempt(false);
    }
  };

  return (
    <div className="feynman-container">
      {/* 页面头部 */}
      <div className="feynman-header">
        <Link to="/" className="back-link">← 返回列表</Link>
        <h1>🎤 复述知识点: <span className="kp-title">{kpTitle}</span></h1>
      </div>

      {!!loadError && <div className="feynman-error">❌ {loadError}</div>}

      {/* 录音区域 */}
      <div className="recorder-card">
        <VoiceRecorder 
          onTranscribeComplete={handleTranscribeComplete} 
          relatedId={id}
          transcribedText={transcribedText}
          onTextChange={setTranscribedText}
        />
      </div>
      
      {/* 提交评估按钮 */}
      <div className="submit-section">
        <button
          onClick={() => getStagedEvaluation(transcribedText)}
          disabled={!transcribedText || transcribedText.startsWith('转录失败') || isEvaluating}
          className="btn-evaluate"
        >
          {isEvaluating ? '⏳ 正在评估...' : '🔍 AI 三阶段评估'}
        </button>
        {transcribedText && !transcribedText.startsWith('转录失败') && !isEvaluating && (
          <span className="submit-hint">💡 可先编辑转录文本，再提交评估</span>
        )}
      </div>

      {/* AI反馈展示区域 */}
      <div className="feedback-section">
        <h2>🤖 AI 教练反馈</h2>
        
        {isEvaluating && (
          <div className="ai-loading">
            <div className="ai-loading-icon">🧑‍🏫</div>
            <p className="ai-loading-text">AI教练正在批阅您的答卷...</p>
            <p className="ai-loading-hint">预计需要 5-10 秒，请耐心等待</p>
            <div className="ai-loading-badge">💡 正在分析您的表述、润色文本、评估质量...</div>
          </div>
        )}

        {evaluationError && (
          <div className="error-retry">
            <p>{evaluationError}</p>
            <button onClick={() => getStagedEvaluation(transcribedText)} className="btn-retry">
              🔄 重新评价
            </button>
          </div>
        )}

        {stagedResult && !isEvaluating && (
          <div>
            <div className="save-options">
              <button onClick={handleSaveAttempt} disabled={isSavingAttempt} className="btn-save">
                {isSavingAttempt ? '⏳ 正在保存...' : '💾 保存本次结果'}
              </button>
              {!!saveAttemptMsg && (
                <span className={`save-msg ${saveAttemptMsg.includes('失败') ? 'error' : 'success'}`}>
                  {saveAttemptMsg}
                </span>
              )}
            </div>
            <StagedEvaluationResult result={stagedResult} />
          </div>
        )}
      </div>
    </div>
  );
}

export default FeynmanRecordPage;
