// src/pages/FeynmanRecordPage.jsx
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import apiClient from '../api/axios';
import VoiceRecorder from '../components/VoiceRecorder';
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
  const [aiFeedback, setAiFeedback] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState('');
  const [originalContent, setOriginalContent] = useState(''); // 保存原始知识点内容

  // 分开保存的选项与状态
  const [saveTranscribed, setSaveTranscribed] = useState(true);
  const [savePolished, setSavePolished] = useState(true);
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


  // 🆕 获取AI评价
  const getAiEvaluation = async (transcribed, attemptIdParam) => {
    setIsEvaluating(true);
    setAiFeedback(null);
    setEvaluationError('');
    
    try {
      // 调用评价API（后端将基于 knowledgePointId 读取原文作为标准答案）
      const response = await apiClient.post('/audio/evaluate', {
        knowledgePointId: id,
        transcribedText: transcribed,
        attemptId: attemptIdParam || attemptId || undefined
      }, {
        timeout: 35000  // 35秒超时(使用快速模型)
      });

      const feedback = response.data;
      setAiFeedback(feedback);

      // 根据分数自动更新复习状态
      if (feedback.score < 60) {
        // 分数低于60，标记为需复习
        await apiClient.put(`/knowledge-points/${id}/review`, {
          reviewList: true
        });
        console.log('✅ 已自动标记为需复习');
      } else {
        // 分数≥ 60，解除复习标记
        await apiClient.put(`/knowledge-points/${id}/review`, {
          reviewList: false
        });
        console.log('✅ 已自动解除复习标记');
      }

    } catch (error) {
      console.error('获取AI评价失败:', error);
      
      if (error.code === 'ECONNABORTED') {
        setEvaluationError('AI评价超时,请稍后重试');
      } else {
        const msg = error?.response?.data?.msg || error.message || '评价失败';
        setEvaluationError(`AI评价失败: ${msg}`);
      }
    } finally {
      setIsEvaluating(false);
    }
  };

  // 转录完成后的回调
  const handleTranscribeComplete = (text) => {
    setTranscribedText(text);
    // ✏️ 不再自动评估，等待用户编辑后手动提交
  };

  // 仅发起 AI 评估（不保存）
  const handleEvaluateOnly = async () => {
    if (!transcribedText || transcribedText.startsWith('转录失败')) return;
    await getAiEvaluation(transcribedText);
  };

  // 评估完成后可选择保存（可选保存转录文本/AI润色文本）
  const handleSaveAttempt = async () => {
    if (!aiFeedback) return;
    setIsSavingAttempt(true);
    setSaveAttemptMsg('');
    try {
      const payload = {
        knowledgePointId: id,
        score: aiFeedback.score,
        feedback: aiFeedback.evaluation + '\n' + (aiFeedback.strengths || []).map(s=>`优点: ${s}`).join('\n') + '\n' + (aiFeedback.weaknesses || []).map(w=>`待改进: ${w}`).join('\n'),
        standardAnswer: aiFeedback.standardAnswer || originalContent,
      };
      if (saveTranscribed) payload.transcribedText = transcribedText;
      if (savePolished) payload.polishedText = aiFeedback.polishedText;

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
          onClick={handleEvaluateOnly} 
          disabled={!transcribedText || transcribedText.startsWith('转录失败') || isEvaluating}
          className="btn-evaluate"
        >
          {isEvaluating ? '⏳ 正在评估...' : '🚀 提交 AI 评估'}
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
            <button onClick={() => getAiEvaluation(transcribedText)} className="btn-retry">
              🔄 重新评价
            </button>
          </div>
        )}

        {aiFeedback && !isEvaluating && (
          <div>
            {/* 保存选项 */}
            <div className="save-options">
              <div className="save-options-inner">
                <label className="save-checkbox">
                  <input type="checkbox" checked={saveTranscribed} onChange={e => setSaveTranscribed(e.target.checked)} />
                  <span>保存原始转录文本</span>
                </label>
                <label className="save-checkbox">
                  <input type="checkbox" checked={savePolished} onChange={e => setSavePolished(e.target.checked)} />
                  <span>保存AI润色后的文本</span>
                </label>
                <button onClick={handleSaveAttempt} disabled={isSavingAttempt} className="btn-save">
                  {isSavingAttempt ? '⏳ 正在保存...' : '💾 保存本次结果'}
                </button>
                {!!saveAttemptMsg && (
                  <span className={`save-msg ${saveAttemptMsg.includes('失败') ? 'error' : 'success'}`}>
                    {saveAttemptMsg}
                  </span>
                )}
              </div>
            </div>

            {/* 重新评估提示 */}
            <div className="reevaluate-hint">
              <span>💡 如果需要修改转录文本，请向上滚动编辑，然后点击：</span>
              <button
                onClick={() => getAiEvaluation(transcribedText, attemptId)}
                disabled={isEvaluating}
                className="btn-reevaluate"
              >
                🔄 重新评估
              </button>
            </div>
            
            <div className="feedback-content">
              {/* 左侧: 文本和评价 */}
              <div className="feedback-main">
                <section className="feedback-card standard">
                  <h3>📖 标准答案（知识点原文）</h3>
                  <p>{aiFeedback.standardAnswer || originalContent}</p>
                </section>

                <section className="feedback-card polished">
                  <h3>✨ AI润色后的文本</h3>
                  <p>{aiFeedback.polishedText}</p>
                </section>

                <section className="feedback-card">
                  <h3>📝 综合评价</h3>
                  <p>{aiFeedback.evaluation}</p>
                </section>

                <section className="feedback-card">
                  <h3>👍 优点</h3>
                  <ul>
                    {aiFeedback.strengths.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="feedback-card">
                  <h3>💡 待改进</h3>
                  <ul>
                    {aiFeedback.weaknesses.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </section>
              </div>

              {/* 右侧: 分数 */}
              <div className="feedback-score">
                <h3>综合得分</h3>
                <div className={`score-value ${aiFeedback.score > 80 ? 'high' : 'low'}`}>
                  {aiFeedback.score}
                </div>
                <p className="score-max">满分 100</p>
                {aiFeedback.score < 60 && (
                  <div className="review-warning">⚠️ 已自动标记为需复习</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default FeynmanRecordPage;
