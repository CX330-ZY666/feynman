// src/pages/KnowledgePointFormPage.jsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../api/axios';
import LocalVoiceRecorder from '../components/LocalVoiceRecorder';
import TagSelector from '../components/TagSelector';
import RelationshipManager from '../components/RelationshipManager';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import QuillMarkdown from 'quilljs-markdown';
import './KnowledgePointFormPage.css';

function KnowledgePointFormPage() {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState(''); // content 现在将存储 HTML
    const [tags, setTags] = useState([]);
    const [status, setStatus] = useState('learning'); // 学习状态：learning/mastered/reviewing
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditing = Boolean(id);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false); // 添加标志位

    // ReactQuill ref & modules
    const quillRef = useRef(null);
    const quillModules = useMemo(() => ({
        toolbar: [
            [{ header: [1, 2, 3, false] }],
            ['bold', 'italic', 'strike', 'blockquote'],
            [{ list: 'ordered' }, { list: 'bullet' }],
            ['link', 'image', 'code-block'],
            ['clean']
        ]
    }), []);
    const quillFormats = ['header', 'bold', 'italic', 'strike', 'blockquote', 'list', 'bullet', 'link', 'image', 'code-block'];

    // 当 ID 改变时重置加载状态
    useEffect(() => {
        setDataLoaded(false);
        setTitle('');
        setContent('');
        setTags([]);
        setStatus('learning');
        console.log('ID 已改变，重置状态');
    }, [id]);

    // 编辑模式加载已有数据
    useEffect(() => {
        if (!isEditing || dataLoaded) return; // 如果已加载，不再重复加载
        
        const fetchKp = async () => {
            try {
                setLoading(true);
                setError('');
                console.log('正在加载知识点 ID:', id);
                const res = await apiClient.get(`/knowledge-points/${id}`);
                const kp = res.data;
                console.log('加载的知识点数据:', kp);
                console.log('内容长度:', kp?.content?.length);
                
                setTitle(kp?.title || '');
                setContent(kp?.content || '');
                setTags(kp?.tags || []);
                setStatus(kp?.status || 'learning');
                setDataLoaded(true); // 标记为已加载
                
                console.log('数据加载完成');
            } catch (e) {
                console.error('加载知识点失败', e);
                setError('加载知识点失败: ' + (e?.response?.data?.msg || e.message));
            } finally {
                setLoading(false);
            }
        };
        
        fetchKp();
    }, [id, isEditing, dataLoaded]);

    // 绑定 Quill 的 Markdown 快捷键支持：# 空格 → H1 等（仅 WYSIWYG）
    useEffect(() => {
        // 在编辑模式下，等数据加载完成后再初始化
        if (isEditing && !dataLoaded) return;
        
        const quill = quillRef.current?.getEditor?.();
        if (!quill || quill.__markdownBound) return;
        try {
            new QuillMarkdown(quill, {
                bold: true,
                italic: true,
                header: true,
                list: true,
                blockquote: true,
                codeblock: true,
                strike: true,
                link: true
            });
            quill.__markdownBound = true;
            console.log('Quill Markdown 已初始化');
        } catch (e) {
            console.warn('初始化 Quill Markdown 快捷键失败：', e?.message);
        }
    }, [isEditing, dataLoaded]);

    const handleVoiceTranscribeComplete = (text) => {
        // 将转录的文本追加到 content 中
        if (text && !text.startsWith('转录失败')) {
            setContent((prev) => (prev ? prev + '\n' + text : text));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        // 注意：content 现在是 HTML，后端需要能处理 HTML
        const kpData = { title, content, tags, status };
        try {
            setLoading(true);
            setError('');
            if (isEditing) {
                await apiClient.put(`/knowledge-points/${id}`, kpData);
            } else {
                await apiClient.post('/knowledge-points', kpData);
            }
            navigate('/');
        } catch (error) {
            console.error('保存知识点失败', error);
            setError(error?.response?.data?.msg || '保存知识点失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="kp-form-container">
            {/* 页面头部 */}
            <div className="kp-form-header">
                <Link to="/" className="back-link">← 返回列表</Link>
                <h1>{isEditing ? '✏️ 编辑知识点' : '✨ 新建知识点'}</h1>
                {isEditing && (
                    <div className="kp-form-meta">
                        ID: {id} · 标题长度: {title.length} · 内容长度: {content.length}
                    </div>
                )}
            </div>

            {/* 加载状态 */}
            {loading && <div className="kp-form-loading">加载中...</div>}
            
            {/* 错误提示 */}
            {!!error && <div className="kp-form-error">❌ {error}</div>}

            {/* 表单卡片 */}
            <div className="kp-form-card">
                <form onSubmit={handleSubmit}>
                    {/* 标题输入 */}
                    <div className="form-group">
                        <label className="form-label">📌 标题</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            className="form-input"
                            placeholder="输入知识点标题..."
                        />
                    </div>

                    {/* 学习状态选择 */}
                    <div className="form-group">
                        <label className="form-label">📈 学习状态</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="form-input"
                        >
                            <option value="learning">学习中（learning）</option>
                            <option value="mastered">已掌握（mastered）</option>
                            <option value="reviewing">复习中（reviewing）</option>
                        </select>
                    </div>

                    {/* 标签选择 */}
                    <div className="form-group">
                        <TagSelector selectedTags={tags} onChange={setTags} />
                    </div>

                    {/* 内容输入 */}
                    <div className="form-group">
                        <div className="content-header">
                            <label className="form-label">📝 内容</label>
                            {!isEditing && (
                                <button 
                                    type="button" 
                                    onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
                                    className={`voice-btn ${showVoiceRecorder ? 'active' : ''}`}
                                >
                                    {showVoiceRecorder ? '🔽 隐藏语音' : '🎤 添加语音'}
                                </button>
                            )}
                        </div>
                        
                        {/* 语音录制区 */}
                        {!isEditing && showVoiceRecorder && (
                            <div className="voice-recorder-wrapper">
                                <LocalVoiceRecorder onTranscribeComplete={handleVoiceTranscribeComplete} />
                            </div>
                        )}
                        
                        {/* 富文本编辑器 */}
                        <div className="editor-wrapper">
                            <ReactQuill 
                                ref={quillRef}
                                theme="snow" 
                                value={content} 
                                onChange={setContent} 
                                placeholder="开始输入内容... （支持 Markdown 快捷键：# 空格 → 标题）"
                                modules={quillModules}
                                formats={quillFormats}
                            />
                        </div>
                    </div>

                    {/* 提交按钮 */}
                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? '保存中...' : (isEditing ? '💾 更新知识点' : '🚀 创建知识点')}
                    </button>
                </form>
            </div>

            {/* 关系管理（仅编辑模式显示） */}
            {isEditing && dataLoaded && (
                <div className="kp-form-card" style={{ marginTop: '20px' }}>
                    <RelationshipManager 
                        currentKpId={id} 
                        onRelationsChange={() => {
                            console.log('关系已更新，可以刷新相关数据');
                        }}
                    />
                </div>
            )}
        </div>
    );
}
export default KnowledgePointFormPage;
