import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api/axios';
import AppIcon from '../components/ui/AppIconFixed';
import PracticeVoiceInput from '../components/PracticeVoiceInput';
import './PracticeChat.css';

const historyOf = messages => messages.filter(m => m.status !== 'failed').map(({ role, content }) => ({ role, content }));
const errorText = err => err.response?.data?.msg || err.message || '请求失败，请稍后重试';
let messageSequence = 0;
const newMessageId = () => globalThis.crypto?.randomUUID?.() || `message-${Date.now()}-${++messageSequence}`;
export default function FeynmanPracticePage() {
  const { id } = useParams();
  return <PracticeSession key={id} id={id} />;
}
function PracticeSession({ id }) {
  const { user } = useAuth();
  const [point, setPoint] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [ending, setEnding] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [newMessages, setNewMessages] = useState(false);
  const [summary, setSummary] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const live = useRef(true), lock = useRef(false), endLock = useRef(false), voiceBusyRef = useRef(false);
  const messagesRef = useRef([]), failed = useRef(null), summaryRef = useRef(null);
  const requests = useRef(new Set()), scroll = useRef(null), nearBottom = useRef(true), input = useRef(null);
  const commit = value => { messagesRef.current = value; setMessages(value); };
  const post = async (path, body) => {
    const controller = new AbortController(); requests.current.add(controller);
    try { return await apiClient.post(path, body, { signal: controller.signal }); }
    finally { requests.current.delete(controller); }
  };
  useEffect(() => {
    live.current = true;
    const controller = new AbortController();
    apiClient.get(`/knowledge-points/${id}`, { signal: controller.signal }).then(({ data }) => {
      if (!live.current) return;
      setPoint(data); commit([{ id: 'welcome', role: 'ai', content: `你好，我是小问。请用自己的话讲讲「${data.title}」，把我当作完全没有基础的同学。` }]);
    }).catch(err => { if (!controller.signal.aborted) setLoadError(errorText(err)); });
    const pending = requests.current;
    return () => { live.current = false; controller.abort(); pending.forEach(c => c.abort()); };
  }, [id]);
  useEffect(() => {
    const resizeInput = () => {
      const element = input.current;
      if (element) { element.style.height = 'auto'; element.style.height = `${Math.min(144, element.scrollHeight + 4)}px`; }
    };
    resizeInput(); window.addEventListener('resize', resizeInput);
    return () => window.removeEventListener('resize', resizeInput);
  }, [draft, voiceMode]);
  useEffect(() => {
    const resize = () => {
      const viewport = window.visualViewport;
      const windowElement = scroll.current?.parentElement;
      if (!windowElement || !window.matchMedia('(max-width: 768px)').matches) return;
      const available = (viewport?.height || window.innerHeight) - windowElement.getBoundingClientRect().top - 88;
      windowElement.style.setProperty('--pc-chat-height', `${Math.max(240, available)}px`);
    };
    resize(); window.visualViewport?.addEventListener('resize', resize); window.addEventListener('resize', resize);
    return () => { window.visualViewport?.removeEventListener('resize', resize); window.removeEventListener('resize', resize); };
  }, [point]);
  useEffect(() => {
    if (!showSummary) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('.pc-summary');
    const handleKey = e => {
      if (e.key === 'Escape') setShowSummary(false);
      if (e.key !== 'Tab') return;
      const buttons = dialog?.querySelectorAll('button, a[href], input, textarea, [tabindex="0"]');
      if (!buttons?.length) return;
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    dialog?.querySelector('button')?.focus(); document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('keydown', handleKey); previous?.focus(); };
  }, [showSummary]);
  useEffect(() => {
    if (nearBottom.current) scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' });
    else setNewMessages(true);
  }, [messages, thinking]);
  const endPractice = async (snapshot = messagesRef.current, automatic = false) => {
    if (endLock.current || lock.current || voiceBusyRef.current) return;
    if (!snapshot.some(m => m.role === 'user' && m.status !== 'failed')) { setNotice('先发送一段讲解，再结束练习。'); return; }
    if (!automatic && draft.trim() && !window.confirm('还有未发送的文字，确定先结束练习吗？文字草稿会保留。')) return;
    if (summaryRef.current) { setShowSummary(true); return; }
    endLock.current = true; setEnding(true); setNotice('');
    const body = { knowledgePointId: id, conversationHistory: historyOf(snapshot) };
    try {
      const results = await Promise.allSettled([post('/feynman-practice/summary', body), post('/feynman-practice/evaluate-understanding', body)]);
      if (!live.current) return;
      const result = { ...(results[0].status === 'fulfilled' ? results[0].value.data : { summary: '普通总结暂时不可用', suggestions: [] }),
        ...(results[1].status === 'fulfilled' ? results[1].value.data : {}),
        evaluationError: results[1].status === 'rejected' ? errorText(results[1].reason) : '',
        summaryError: results[0].status === 'rejected' ? errorText(results[0].reason) : '' };
      summaryRef.current = result; setSummary(result); setShowSummary(true);
    } finally { endLock.current = false; if (live.current) setEnding(false); }
  };
  const send = async (text, retry = false, clearDraft = true) => {
    const content = text.trim();
    if (!content || lock.current || endLock.current || summaryRef.current) return;
    if (content.length > 5000) { setNotice('讲解超过5000字，请编辑缩短后再发送。'); return; }
    lock.current = true; setThinking(true); setNotice(''); nearBottom.current = true;
    const previous = retry ? failed.current?.history : historyOf(messagesRef.current);
    if (!previous) { lock.current = false; setThinking(false); return; }
    const message = retry ? failed.current.message : { id: newMessageId(), role: 'user', content };
    const next = retry ? messagesRef.current.map(m => m.id === message.id ? { ...message, status: 'sending' } : m) : [...messagesRef.current, { ...message, status: 'sending' }];
    commit(next); if (!retry && clearDraft) setDraft('');
    try {
      const { data } = await post('/feynman-practice/ask', { knowledgePointId: id, userExplanation: content, conversationHistory: previous });
      if (!live.current) return;
      if (!data.question?.trim()) throw new Error('AI未返回有效回复，请重试');
      const completed = [...messagesRef.current.map(m => m.id === message.id ? { ...message, status: 'sent' } : m), { id: newMessageId(), role: 'ai', content: data.question }];
      commit(completed); failed.current = null; lock.current = false;
      if (data.shouldContinue === false && (clearDraft || !draft.trim())) await endPractice(completed, true);
    } catch (err) {
      if (!live.current) return;
      failed.current = { message, history: previous };
      commit(messagesRef.current.map(m => m.id === message.id ? { ...message, status: 'failed' } : m));
      setNotice(errorText(err));
    } finally { lock.current = false; if (live.current) setThinking(false); }
  };
  const disabled = thinking || ending || voiceBusy || !!summaryRef.current;
  if (loadError) return <section className="practice-chat pc-load"><p role="alert">{loadError}</p><Link to="/feynman-practice">返回知识点选择</Link></section>;
  if (!point) return <section className="practice-chat pc-load" aria-busy="true"><div className="ui-skeleton"><span /><span /><span /></div><p>正在准备对话…</p></section>;
  return <section className="practice-chat">
    <header className="pc-header"><div><span className="pc-eyebrow">FEYNMAN DIALOGUE</span><h1><AppIcon name="practice" size={28} />费曼问答</h1><p>{point.title}</p></div>
      <div className="pc-actions"><Link to="/feynman-practice">返回</Link><button onClick={() => endPractice()} disabled={thinking || ending || voiceBusy}>{ending ? '正在生成反馈…' : summary ? '查看总结' : '结束练习'}</button></div>
    </header>
    <details className="pc-source" onToggle={() => window.dispatchEvent(new Event('resize'))}><summary><AppIcon name="book" />知识原文 · 点击展开</summary><div>{new DOMParser().parseFromString(point.content || '', 'text/html').body.textContent}</div></details>
    <div className="pc-window">
      <div className="pc-messages" ref={scroll} role="log" aria-label="与小问的对话" onScroll={() => { const e = scroll.current; nearBottom.current = e.scrollHeight - e.scrollTop - e.clientHeight < 80; if (nearBottom.current) setNewMessages(false); }}>
        {messages.map(msg => <article key={msg.id} className={`pc-message pc-${msg.role}`}>
          <span className="pc-avatar"><AppIcon name={msg.role === 'ai' ? 'assistant' : 'user'} size={24} accent={msg.role === 'ai' ? '#A8D1D3' : '#EFD46D'} /></span>
          <div className="pc-message-body"><span className="pc-sender">{msg.role === 'ai' ? '小问 · AI同学' : '你'}</span><div className="pc-bubble">{msg.content}</div>
            {msg.status === 'failed' && <span className="pc-error">发送失败（重试可能再次计次） {failed.current?.message.id === msg.id && <button disabled={disabled} onClick={() => send(msg.content, true)}>重试</button>}</span>}
          </div>
        </article>)}
        {thinking && <p className="pc-status" role="status">小问正在思考…</p>}
      </div>
      {newMessages && <button className="pc-new" onClick={() => { nearBottom.current = true; setNewMessages(false); scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: 'smooth' }); }}>有新消息 · 回到底部</button>}
      <div className="pc-composer">
        {notice && <p className="pc-error" role="alert">{notice}</p>}
        {summary && <p className="pc-status">本次练习已结束。<button onClick={() => setShowSummary(true)}>查看总结与评估</button></p>}
        <div className="pc-compose-row">
          <button type="button" className="pc-mode" aria-label={voiceMode ? '切换文字输入' : '切换语音输入'} disabled={disabled} onClick={() => setVoiceMode(!voiceMode)}><AppIcon name={voiceMode ? 'edit' : 'microphone'} size={24} /></button>
          <div className="pc-input-wrap">{voiceMode ? !user ? <p>正在确认账号状态…</p> : user.guest ? <p>体验账号暂不支持在线转写。<Link to="/register">注册并保留数据</Link>，或切回文字输入。</p> : <PracticeVoiceInput relatedId={id} disabled={thinking || ending || !!summary} onBusy={value => { voiceBusyRef.current = value; setVoiceBusy(value); }} onText={text => { setDraft(previous => previous.trim() ? previous + '\n' + text : text); setVoiceMode(false); setNotice('语音已转写到输入框，请检查或修改后点击发送。'); requestAnimationFrame(() => input.current?.focus()); }} /> : <>
            <label className="pc-sr-only" htmlFor="practice-message">你的讲解</label>
            <textarea id="practice-message" ref={input} rows={1} maxLength={5000} value={draft} disabled={thinking || ending || !!summary} placeholder="用自己的话讲解…" onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229 && window.matchMedia('(min-width: 769px) and (pointer: fine)').matches) { e.preventDefault(); send(draft); } }} />
          </>}</div>
          {!voiceMode && <button className="pc-send" disabled={disabled || !draft.trim()} onClick={() => send(draft)}><AppIcon name="send" />发送</button>}
        </div>
        {!voiceMode && <small>电脑 Enter 发送，Shift + Enter 换行；手机点击发送。最多5000字。</small>}
      </div>
    </div>
    {showSummary && summary && <div className="pc-overlay" onClick={e => { if (e.target === e.currentTarget) setShowSummary(false); }}><section className="pc-summary" role="dialog" aria-modal="true" aria-labelledby="pc-summary-title"><h2 id="pc-summary-title">本次练习反馈</h2><button aria-label="关闭总结" className="pc-close" autoFocus onClick={() => setShowSummary(false)}><AppIcon name="close" /></button>{summary.understandingScore != null && <p className="pc-score">理解度 {summary.understandingScore} 分</p>}<p>{summary.summary}</p><p>{summary.feedback}</p>{summary.isParroting && <p>尝试用自己的语言表达，而不只是复述原文。</p>}{[...(summary.strengths || []), ...(summary.weaknesses || []), ...(summary.suggestions || [])].map((s, i) => <p key={i}>{s}</p>)}{summary.evaluationError && <p className="pc-error" role="alert">理解度评估未完成：{summary.evaluationError}</p>}{summary.summaryError && <p className="pc-error">{summary.summaryError}</p>}<button onClick={() => setShowSummary(false)}>返回对话</button></section></div>}
  </section>;
}
