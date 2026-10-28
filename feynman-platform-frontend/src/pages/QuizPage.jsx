// src/pages/QuizPage.jsx
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/axios';
import AppIcon from '../components/ui/AppIconFixed';
import './QuizPage.css';

function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // 状态管理
  const [knowledgePoint, setKnowledgePoint] = useState(null);
  const [questionType, setQuestionType] = useState('single-choice');
  const [difficulty, setDifficulty] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selectedOption, setSelectedOption] = useState('');
  const [shortAnswer, setShortAnswer] = useState('');
  const [results, setResults] = useState([]);
  const [isFinished, setIsFinished] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isGrading, setIsGrading] = useState(false);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());

  // 加载知识点
  useEffect(() => {
    const fetchKp = async () => {
      try {
        const response = await apiClient.get(`/knowledge-points/${id}`);
        setKnowledgePoint(response.data);
      } catch (error) {
        console.error('加载知识点失败:', error);
        alert('加载知识点失败');
      }
    };
    fetchKp();
  }, [id]);


  // 批量生成题目
  const fetchQuestions = async (selectedDifficulty, count) => {
    if (!knowledgePoint) return;
    
    setIsLoading(true);
    setDifficulty(selectedDifficulty);
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setResults([]);
    setIsFinished(false);
    setSelectedOption('');
    setShortAnswer('');
    
    try {
      const promises = [];
      for (let i = 0; i < count; i++) {
        promises.push(
          apiClient.post('/ai/generate-question', {
            knowledgePointContent: knowledgePoint.content,
            difficulty: selectedDifficulty,
            type: questionType
          })
        );
      }
      
      const responses = await Promise.all(promises);
      const generatedQuestions = responses.map(res => res.data);
      setQuestions(generatedQuestions);
      setAnswers(new Array(count).fill(''));
      setResults(new Array(count).fill(null));
    } catch (error) {
      console.error('生成题目失败:', error);
      alert(error.response?.data?.msg || '生成题目失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  // 提交当前题目答案
  const submitCurrent = async () => {
    const currentQuestion = questions[currentIndex];
    let result = null;

    if (questionType === 'single-choice') {
      if (!selectedOption) {
        return { ok: false, reason: 'no-selection' };
      }
      
      // 调用AI解析接口获取详细解析
      setIsGrading(true);
      try {
        const response = await apiClient.post('/ai/explain-choice', {
          question: currentQuestion.question,
          options: currentQuestion.options,
          correctAnswer: currentQuestion.answer,
          userAnswer: selectedOption,
          originalExplanation: currentQuestion.explanation
        });
        result = response.data;
      } catch (error) {
        console.error('AI解析失败:', error);
        console.error('错误详情:', error.response?.data || error.message);
        
        // 如果AI解析失败，使用简单的结果
        const isCorrect = selectedOption === currentQuestion.answer;
        const errorMsg = error.response?.data?.msg || error.message || '网络错误';
        
        result = {
          isCorrect,
          userAnswer: selectedOption,
          correctAnswer: currentQuestion.answer,
          correctExplanation: currentQuestion.explanation || `正确答案是 ${currentQuestion.answer}。${currentQuestion.explanation || ''}`,
          wrongExplanation: `AI解析暂时不可用：${errorMsg}`,
          knowledgePoints: 'AI解析服务暂时不可用，请稍后重试或联系管理员',
          _hasError: true
        };
      }
      setIsGrading(false);
    } else {
      if (!shortAnswer.trim()) {
        return { ok: false, reason: 'no-answer' };
      }
      setIsGrading(true);
      try {
        const response = await apiClient.post('/ai/grade-answer', {
          question: currentQuestion.question,
          answerKeyPoints: currentQuestion.answer_key_points,
          studentAnswer: shortAnswer,
          knowledgePointId: id
        });
        result = response.data;
      } catch (error) {
        console.error('AI评分失败:', error);
        alert(error.response?.data?.msg || 'AI评分失败');
        setIsGrading(false);
        return { ok: false, reason: 'grade-error' };
      }
      setIsGrading(false);
    }

    const newAnswers = [...answers];
    const newResults = [...results];
    newAnswers[currentIndex] = questionType === 'single-choice' ? selectedOption : shortAnswer;
    newResults[currentIndex] = result;
    setAnswers(newAnswers);
    setResults(newResults);

    // 提交后自动滚动到结果区域
    setTimeout(() => {
      const resultElement = document.querySelector('[data-result-area]');
      if (resultElement) {
        resultElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    if (currentIndex === questions.length - 1) {
      setIsFinished(true);
      // 检查所有题目的结果
      const hasWrong = newResults.some(r => !r.isCorrect);
      const allCorrect = newResults.every(r => r.isCorrect);
      
      if (hasWrong) {
        // 有错题，加入复习列表
        updateReviewStatus(true);
      } else if (allCorrect) {
        // 全部答对，移除复习状态
        updateReviewStatus(false);
      }
    }

    return { ok: true };
  };

  // 提交答案
  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await submitCurrent();
    if (!res?.ok) {
      if (res.reason === 'no-selection') alert('请选择一个答案！');
      if (res.reason === 'no-answer') alert('请输入答案！');
    }
  };

  // 下一题
  const handleNext = async () => {
    if (results[currentIndex]) {
      nextQuestion();
      return;
    }
    if (questionType === 'single-choice' && !selectedOption) {
      alert('请选择一个答案！');
      return;
    }
    if (questionType === 'short-answer' && !shortAnswer.trim()) {
      alert('请输入答案！');
      return;
    }
    const res = await submitCurrent();
    if (res?.ok) nextQuestion();
  };
  
  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      if (questionType === 'single-choice') {
        setSelectedOption(answers[nextIdx] || '');
      } else {
        setShortAnswer(answers[nextIdx] || '');
      }
    }
  };
  
  const prevQuestion = () => {
    if (currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      if (questionType === 'single-choice') {
        setSelectedOption(answers[prevIdx] || '');
      } else {
        setShortAnswer(answers[prevIdx] || '');
      }
    }
  };
  
  const restart = () => {
    setQuestions([]);
    setCurrentIndex(0);
    setAnswers([]);
    setResults([]);
    setIsFinished(false);
    setSelectedOption('');
    setShortAnswer('');
    setDifficulty('');
  };

  const updateReviewStatus = async (needsReview) => {
    try {
      await apiClient.put(`/knowledge-points/${id}`, { reviewList: needsReview });
      console.log(` 已${needsReview ? '加入' : '移除'}复习列表`);
    } catch (error) {
      console.error('更新复习状态失败:', error);
    }
  };

  if (!knowledgePoint) return <div className="quiz-loading"><p>加载中...</p></div>;

  return (
    <div className="quiz-container">
      {/* 页面头部 */}
      <div className="quiz-header">
        <Link to="/" className="back-link">
          <AppIcon name="back" size={18} accent="#A9BED3" />
          返回列表
        </Link>
        <div className="quiz-title-row">
          <span className="quiz-title-icon">
            <AppIcon name="document" size={28} accent="#EFD46D" />
          </span>
          <div>
            <small>KNOWLEDGE ASSESSMENT</small>
            <h1>知识点测评：<span className="kp-title">{knowledgePoint.title}</span></h1>
          </div>
        </div>
      </div>
      
      {/* 设置区域 */}
      {questions.length === 0 && (
        <div className="quiz-settings">
          {/* 题型切换 */}
          <div className="setting-group">
            <label className="setting-label"> 题型选择</label>
            <div className="type-toggle">
              <button 
                onClick={() => setQuestionType('single-choice')}
                disabled={questions.length > 0}
                className={`type-btn ${questionType === 'single-choice' ? 'active' : ''}`}
              >
                单选题
              </button>
              <button 
                onClick={() => setQuestionType('short-answer')}
                disabled={questions.length > 0}
                className={`type-btn ${questionType === 'short-answer' ? 'active' : ''}`}
              >
                简答题
              </button>
            </div>
          </div>
          
          {/* 题目数量 */}
          <div className="setting-group">
            <label className="setting-label"> 题目数量</label>
            <div className="count-input">
              <input 
                type="number" 
                min="1" 
                max="10" 
                value={questionCount} 
                onChange={(e) => setQuestionCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                disabled={isLoading}
              />
              <span className="count-hint">（1-10题）</span>
            </div>
          </div>
          
          {/* 难度选择 */}
          <div className="setting-group">
            <label className="setting-label"> 选择难度开始测评</label>
            <div className="difficulty-btns">
              {['基础', '中等', '困难'].map(diff => (
                <button 
                  key={diff}
                  onClick={() => fetchQuestions(diff, questionCount)}
                  disabled={isLoading}
                  className="diff-btn"
                >
                  {diff}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* 加载状态 */}
      {isLoading && (
        <div className="quiz-loading">
          <p> AI正在生成 {questionCount} 道题目...</p>
          <p>请稍候，预计需要 {questionCount * 6} 秒</p>
        </div>
      )}
      
      {/* 题目显示区域 */}
      {questions.length > 0 && !isFinished && (
        <div>
          {/* 进度条 */}
          <div className="progress-card">
            <div className="progress-info">
              <span>题目进度: {currentIndex + 1} / {questions.length}</span>
              <span>难度: {difficulty}</span>
            </div>
            <div className="progress-bar">
              <div 
                className="progress-fill"
                style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
              />
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="question-card">
            <h3 className="question-title">
              第 {currentIndex + 1} 题: {questions[currentIndex].question}
            </h3>
            
            {questionType === 'single-choice' ? (
              <div>
                {Object.entries(questions[currentIndex].options).map(([key, value]) => (
                  <div 
                    key={key} 
                    className={`option-item ${selectedOption === key ? 'selected' : ''}`}
                    onClick={() => setSelectedOption(key)}
                  >
                    <input
                      type="radio"
                      id={`q${currentIndex}-${key}`}
                      name="option"
                      value={key}
                      checked={selectedOption === key}
                      onChange={(e) => setSelectedOption(e.target.value)}
                    />
                    <label htmlFor={`q${currentIndex}-${key}`}>
                      {key}. {value}
                    </label>
                  </div>
                ))}
              </div>
            ) : (
              <div>
                <textarea
                  value={shortAnswer}
                  onChange={(e) => setShortAnswer(e.target.value)}
                  placeholder="请用自己的话回答..."
                  className="answer-textarea"
                />
              </div>
            )}
            
            
            <div className="action-btns">
              <div className="btn-group">
                <button 
                  type="button"
                  onClick={prevQuestion}
                  disabled={currentIndex === 0}
                  className="quiz-btn btn-prev"
                >
                  ← 上一题
                </button>
                
                <button 
                  type="submit" 
                  disabled={isGrading}
                  className="quiz-btn btn-submit"
                >
                  {isGrading ? '⏳ 评分中...' : '提交答案'}
                </button>
                
                <button 
                  type="button"
                  onClick={handleNext}
                  disabled={currentIndex === questions.length - 1}
                  className="quiz-btn btn-next"
                >
                  下一题 →
                </button>
              </div>
              
              <button 
                type="button"
                onClick={restart}
                className="quiz-btn btn-restart"
              >
                重新开始
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* 所有题目完成后的统计结果 */}
      {isFinished && (
        <div className="result-card">
          <h2 className="result-title"> 测评完成！</h2>
          
          <div className="stats-grid">
            <div className="stat-box">
              <p className="stat-label">总题数</p>
              <p className="stat-number">{questions.length}</p>
            </div>
            <div className="stat-box correct">
              <p className="stat-label">正确</p>
              <p className="stat-number">{results.filter(r => r.isCorrect).length}</p>
            </div>
            <div className="stat-box wrong">
              <p className="stat-label">错误</p>
              <p className="stat-number">{results.filter(r => !r.isCorrect).length}</p>
            </div>
          </div>
          
          <div className="accuracy-box">
            <p className="accuracy-label">正确率</p>
            <p className="accuracy-value">
              {Math.round((results.filter(r => r.isCorrect).length / questions.length) * 100)}%
            </p>
          </div>
          
          <h3 style={{ marginBottom: '15px' }}>题目明细</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {questions.map((q, idx) => {
              const isExpanded = expandedQuestions.has(idx);
              const toggleExpand = () => {
                const newSet = new Set(expandedQuestions);
                if (isExpanded) {
                  newSet.delete(idx);
                } else {
                  newSet.add(idx);
                }
                setExpandedQuestions(newSet);
              };
              
              return (
                <div key={idx} style={{ 
                  marginBottom: '15px',
                  padding: '15px',
                  background: '#fff',
                  borderRadius: '8px',
                  border: `2px solid ${results[idx].isCorrect ? '#10b981' : '#ef4444'}`
                }}>
                  <div 
                    onClick={toggleExpand}
                    style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      marginBottom: '10px',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{ fontWeight: 'bold' }}>第 {idx + 1} 题 {isExpanded ? '▼' : '▶'}</span>
                    <span style={{ 
                      padding: '4px 12px',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      fontWeight: 'bold',
                      background: results[idx].isCorrect ? '#d1fae5' : '#fee2e2',
                      color: results[idx].isCorrect ? '#065f46' : '#991b1b'
                    }}>
                      {results[idx].isCorrect ? ' 正确' : ' 错误'}
                    </span>
                  </div>
                  
                  <p style={{ color: '#374151', marginBottom: '8px' }}>{q.question}</p>
                  
                  {questionType === 'single-choice' ? (
                    <div>
                      <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '10px' }}>
                        你的答案: <strong>{results[idx].userAnswer}</strong> | 
                        正确答案: <strong>{results[idx].correctAnswer}</strong>
                      </p>
                      
                      {/* 展开显示AI详细解析 */}
                      {isExpanded && (
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {results[idx].correctExplanation && (
                            <div style={{ 
                              padding: '12px', 
                              background: '#d1fae5', 
                              borderRadius: '8px',
                              border: '1px solid #10b981'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#065f46', fontSize: '0.95rem' }}>
                                 为什么正确
                              </p>
                              <p style={{ color: '#064e3b', lineHeight: '1.7', margin: 0 }}>{results[idx].correctExplanation}</p>
                            </div>
                          )}
                          
                          {results[idx].wrongExplanation && (
                            <div style={{ 
                              padding: '12px', 
                              background: results[idx].isCorrect ? '#f3f4f6' : '#fee2e2', 
                              borderRadius: '8px',
                              border: `1px solid ${results[idx].isCorrect ? '#e5e7eb' : '#ef4444'}`
                            }}>
                              <p style={{ 
                                fontWeight: 'bold', 
                                marginBottom: '8px', 
                                color: results[idx].isCorrect ? '#6b7280' : '#991b1b', 
                                fontSize: '0.95rem' 
                              }}>
                                {results[idx].isCorrect ? ' 其他选项分析' : ' 错误原因'}
                              </p>
                              <p style={{ 
                                color: results[idx].isCorrect ? '#374151' : '#7f1d1d', 
                                lineHeight: '1.7', 
                                margin: 0 
                              }}>{results[idx].wrongExplanation}</p>
                            </div>
                          )}
                          
                          {results[idx].knowledgePoints && (
                            <div style={{ 
                              padding: '12px', 
                              background: '#dbeafe', 
                              borderRadius: '8px',
                              border: '1px solid #60a5fa'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e40af', fontSize: '0.95rem' }}>
                                 知识点总结
                              </p>
                              <p style={{ color: '#1e3a8a', lineHeight: '1.7', margin: 0 }}>{results[idx].knowledgePoints}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ marginTop: '8px' }}>
                      {results[idx].score !== undefined && (
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '0.95rem',
                          fontWeight: 'bold',
                          background: results[idx].score >= 90 ? '#d1fae5' :
                                       results[idx].score >= 70 ? '#dbeafe' :
                                       results[idx].score >= 60 ? '#fef3c7' : '#fee2e2',
                          color: results[idx].score >= 90 ? '#065f46' :
                                 results[idx].score >= 70 ? '#1e40af' :
                                 results[idx].score >= 60 ? '#92400e' : '#991b1b'
                        }}>
                          得分: {results[idx].score} / 100
                        </span>
                      )}
                      
                      {/* 展开显示详细评分 */}
                      {isExpanded && (
                        <div style={{ marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          {results[idx].analysis && (
                            <div style={{ 
                              padding: '12px', 
                              background: '#f3f4f6', 
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1f2937', fontSize: '0.95rem' }}>
                                 答案分析
                              </p>
                              <p style={{ color: '#374151', lineHeight: '1.7', margin: 0 }}>{results[idx].analysis}</p>
                            </div>
                          )}
                          
                          {results[idx].suggestions && (
                            <div style={{ 
                              padding: '12px', 
                              background: '#fef3c7', 
                              borderRadius: '8px',
                              border: '1px solid #fbbf24'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#92400e', fontSize: '0.95rem' }}>
                                 改进建议
                              </p>
                              <p style={{ color: '#78350f', lineHeight: '1.7', margin: 0 }}>{results[idx].suggestions}</p>
                            </div>
                          )}
                          
                          {results[idx].standardAnswer && (
                            <div style={{ 
                              padding: '12px', 
                              background: '#dbeafe', 
                              borderRadius: '8px',
                              border: '1px solid #60a5fa'
                            }}>
                              <p style={{ fontWeight: 'bold', marginBottom: '8px', color: '#1e40af', fontSize: '0.95rem' }}>
                                 标准答案
                              </p>
                              <p style={{ color: '#1e3a8a', lineHeight: '1.7', margin: 0 }}>{results[idx].standardAnswer}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          
          {results.some(r => !r.isCorrect) && (
            <div className="review-notice">
               检测到错题，该知识点已加入你的复习列表
            </div>
          )}
          
          <div className="result-actions">
            <button onClick={restart} className="quiz-btn btn-next">
              再来一组
            </button>
            <button onClick={() => navigate('/')} className="quiz-btn btn-prev">
              返回主页
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default QuizPage;
