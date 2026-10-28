import { useState } from 'react';
import './StagedEvaluationResult.css';

function StagedEvaluationResult({ result, followUpQuestions, comparison }) {
  const [activeStage, setActiveStage] = useState(1);

  if (!result) return null;

  const { stage1, stage2, stage3, finalScore, breakdown } = result;

  return (
    <div className="staged-evaluation">
      <div className="stage-progress">
        <div className={`stage-step ${activeStage >= 1 ? 'active' : ''}`} onClick={() => setActiveStage(1)}>
          <div className="step-number">1</div>
          <div className="step-label">概念提取</div>
        </div>
        <div className="progress-line"></div>
        <div className={`stage-step ${activeStage >= 2 ? 'active' : ''}`} onClick={() => setActiveStage(2)}>
          <div className="step-number">2</div>
          <div className="step-label">逻辑结构</div>
        </div>
        <div className="progress-line"></div>
        <div className={`stage-step ${activeStage >= 3 ? 'active' : ''}`} onClick={() => setActiveStage(3)}>
          <div className="step-number">3</div>
          <div className="step-label">误区诊断</div>
        </div>
      </div>

      <div className="stage-content">
        {activeStage === 1 && (
          <div className="stage-panel">
            <h3> 阶段1：概念提取</h3>
            <div className="concept-section">
              <h4> 已提及概念 ({stage1.coveredConcepts.length})</h4>
              <div className="concept-tags">
                {stage1.coveredConcepts.map((c, i) => (
                  <span key={i} className="tag covered">{c}</span>
                ))}
              </div>
            </div>
            <div className="concept-section">
              <h4> 遗漏概念 ({stage1.missedConcepts.length})</h4>
              <div className="concept-tags">
                {stage1.missedConcepts.map((c, i) => (
                  <span key={i} className="tag missed">{c}</span>
                ))}
              </div>
            </div>
            <div className="score-badge">覆盖率: {breakdown.coverage}%</div>
          </div>
        )}

        {activeStage === 2 && (
          <div className="stage-panel">
            <h3> 阶段2：逻辑结构评分</h3>
            <div className="logic-score">
              <div className="score-circle">{stage2.logicScore}</div>
              <p>逻辑结构得分</p>
            </div>
            {stage2.logicIssues.length > 0 && (
              <div className="issues-section">
                <h4>发现的问题：</h4>
                <ul>
                  {stage2.logicIssues.map((issue, i) => (
                    <li key={i}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeStage === 3 && (
          <div className="stage-panel">
            <h3> 阶段3：误区诊断</h3>
            {stage3.misconceptions.length > 0 ? (
              <div className="misconceptions">
                {stage3.misconceptions.map((m, i) => (
                  <div key={i} className="misconception-card">
                    <div className="misconception-point"> {m.point}</div>
                    <div className="misconception-correction"> {m.correction}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="no-misconceptions"> 未发现理解误区</div>
            )}
            <div className="strengths-suggestions">
              <div className="strengths">
                <h4> 优点</h4>
                <ul>
                  {stage3.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div className="suggestions">
                <h4> 建议</h4>
                <ul>
                  {stage3.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="final-score-panel">
        <h3>综合得分</h3>
        <div className={`final-score ${finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low'}`}>
          {finalScore}
        </div>
        <div className="breakdown-details">
          <span>覆盖率 {breakdown.coverage}%</span>
          <span>逻辑 {breakdown.logic}分</span>
          <span>准确性 {breakdown.accuracy}%</span>
        </div>
      </div>

      {followUpQuestions && followUpQuestions.questions && (
        <div className="follow-up-section">
          <h3> 深度追问</h3>
          <p className="follow-up-hint">针对您的薄弱环节，AI教练为您准备了以下问题：</p>
          <div className="follow-up-questions">
            {followUpQuestions.questions.map((q, i) => (
              <div key={i} className="follow-up-card">
                <div className="question-number">Q{i + 1}</div>
                <div className="question-content">
                  <div className="question-text">{q.question}</div>
                  <div className="question-focus">聚焦：{q.focus}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {comparison && comparison.hasHistory && (
        <div className="comparison-section">
          <h3> 学习进步分析</h3>
          <div className="score-change">
            <span className="change-label">得分变化：</span>
            <span className={`change-value ${comparison.scoreChange >= 0 ? 'positive' : 'negative'}`}>
              {comparison.scoreChange >= 0 ? '+' : ''}{comparison.scoreChange}
            </span>
          </div>
          <div className="comparison-grid">
            {comparison.improvements.length > 0 && (
              <div className="comparison-card improvements">
                <h4> 进步之处</h4>
                <ul>
                  {comparison.improvements.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
            {comparison.regressions.length > 0 && (
              <div className="comparison-card regressions">
                <h4> 需要注意</h4>
                <ul>
                  {comparison.regressions.map((item, i) => <li key={i}>{item}</li>)}
                </ul>
              </div>
            )}
          </div>
          {comparison.suggestions.length > 0 && (
            <div className="comparison-suggestions">
              <h4> 改进建议</h4>
              <ul>
                {comparison.suggestions.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StagedEvaluationResult;
