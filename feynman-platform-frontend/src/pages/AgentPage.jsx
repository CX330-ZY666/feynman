// src/pages/AgentPage.jsx
import { useState, useRef, useEffect } from 'react';
import apiClient from '../api/axios';
import './AgentPage.css';

function AgentPage() {
    const [messages, setMessages] = useState([
        { sender: 'bot', text: '你好！我是你的专属知识库AI助手。有什么可以帮你的吗？', sources: null }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // 自动滚动到最新消息
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessageStream = async (e) => {
        e.preventDefault();
        if (!inputValue.trim() || isLoading) return;

        const questionText = inputValue;
        const userMessage = { sender: 'user', text: questionText, sources: null };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        // 添加空的机器人消息，将被逐步填充
        setMessages(prev => [...prev, { sender: 'bot', text: '', sources: null }]);

        try {
            console.log('[Frontend] 开始流式请求:', questionText);
            const apiBase = import.meta.env.VITE_API_URL || 'https://feynman-backend.onrender.com/api';
            const response = await fetch(`${apiBase}/ai/rag-qa-stream`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({ question: questionText })
            });

            console.log('[Frontend] 响应状态:', response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let accumulatedText = '';
            console.log('[Frontend] 开始读取流...');

            let chunkCount = 0;
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    console.log('[Frontend] 流结束');
                    break;
                }

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');
                chunkCount++;
                if (chunkCount === 1) {
                    console.log('[Frontend] 收到首个数据块');
                }

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);

                            if (parsed.chunk) {
                                // 确保chunk是字符串
                                const chunkText = typeof parsed.chunk === 'string' ? parsed.chunk : String(parsed.chunk);
                                accumulatedText += chunkText;
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].text = accumulatedText;
                                    return newMessages;
                                });
                            }

                            if (parsed.type === 'sources') {
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    newMessages[newMessages.length - 1].sources = parsed.sources;
                                    return newMessages;
                                });
                            }

                            if (parsed.error) {
                                console.error('Stream error:', parsed.error);
                                // 如果气泡已有内容（后端已发送友好 chunk），不再覆盖
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    if (!newMessages[newMessages.length - 1].text) {
                                        newMessages[newMessages.length - 1].text = '⚠️ AI 服务出现异常，请稍后再试。';
                                    }
                                    return newMessages;
                                });
                            }
                        } catch (e) {
                            console.warn('Failed to parse SSE data:', e);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Streaming error:', error);
            setMessages(prev => {
                const newMessages = [...prev];
                if (!newMessages[newMessages.length - 1].text) {
                    newMessages[newMessages.length - 1].text = '⚠️ 网络请求失败，请检查网络后重试。';
                }
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="agent-page">
            {/* 页面头部 */}
            <div className="agent-header">
                <div className="agent-header-content">
                    <div className="agent-avatar">😊</div>
                    <div className="agent-info">
                        <h1>💬 AI 智能助手</h1>
                        <p>基于你的知识库，智能回答问题</p>
                    </div>
                </div>
                <div className="agent-status">
                    <span className="status-dot"></span>
                    在线
                </div>
            </div>

            {/* 聊天窗口 */}
            <div className="chat-window">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender}`}>
                        <div className={`message-avatar${msg.sender === 'user' ? ' user-avatar' : ''}`}>😊</div>
                        <div className="message-content">
                            <div className="message-bubble">
                                {msg.sender === 'bot' && !msg.text && isLoading && index === messages.length - 1
                                    ? <span className="typing-indicator"><span></span><span></span><span></span></span>
                                    : (typeof msg.text === 'string' ? msg.text : String(msg.text || ''))}
                            </div>
                            {msg.sources && msg.sources.length > 0 && (
                                <div className="message-sources">
                                    <details>
                                        <summary>📚 参考来源 ({msg.sources.length})</summary>
                                        {msg.sources.map((source, idx) => {
                                            // 清理HTML标签
                                            const cleanContent = source.content ? source.content.replace(/<\/?[^>]+(>|$)/g, ' ').replace(/\s+/g, ' ').trim() : '';
                                            return (
                                                <div key={idx} className="source-item">
                                                    <strong>文档 {idx + 1}:</strong>
                                                    <p>{cleanContent}</p>
                                                </div>
                                            );
                                        })}
                                    </details>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* 输入区域 */}
            <form className="chat-input-form" onSubmit={handleSendMessageStream}>
                <div className="input-wrapper">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder="输入你的问题，按 Enter 发送..."
                        disabled={isLoading}
                    />
                </div>
                <button type="submit" disabled={isLoading || !inputValue.trim()}>
                    {isLoading ? (
                        <>✨ 思考中...</>
                    ) : (
                        <>🚀 发送</>
                    )}
                </button>
            </form>
        </div>
    );
}

export default AgentPage;
