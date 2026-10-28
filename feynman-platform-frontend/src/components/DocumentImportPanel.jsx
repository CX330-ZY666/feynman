import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/axios';
import AppIcon from './ui/AppIconFixed';
import './DocumentImportPanel.css';

const escapeHtml = (value) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
export default function DocumentImportPanel({ onImport, disabled }) {
    const [file, setFile] = useState(null);
    const [allowOcr, setAllowOcr] = useState(false);
    const [imageOnly, setImageOnly] = useState(false);
    const [keepImage, setKeepImage] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);
    const [text, setText] = useState('');
    const [title, setTitle] = useState('');
    const [mode, setMode] = useState('append');
    const [applied, setApplied] = useState(false);
    const request = useRef(null);
    const isImage = /\.(png|jpe?g)$/i.test(file?.name || '');
    useEffect(() => () => request.current?.abort(), []);
    const selectFile = (next) => {
        request.current?.abort(); setBusy(false); setResult(null); setApplied(false); setError('');
        if (next && next.size > 10 * 1024 * 1024) { setFile(null); setError('单个文件不能超过10MB'); return; }
        setFile(next || null);
    };
    const parse = async () => {
        if (!file) return;
        const controller = new AbortController(); request.current = controller;
        setBusy(true); setError(''); setResult(null); setApplied(false);
        const data = new FormData(); data.append('file', file);
        try {
            const response = await apiClient.post(`/knowledge-points/import?allowOcr=${allowOcr}&imageOnly=${imageOnly && isImage}`, data, {
                headers: { 'Content-Type': undefined }, signal: controller.signal, timeout: 180000,
            });
            if (request.current !== controller) return;
            setResult(response.data); setText(response.data.text); setTitle(response.data.title);
            setKeepImage(!!response.data.imageDataUrl);
        } catch (e) {
            if (!controller.signal.aborted) setError(e.response?.data?.msg || (e.code === 'ECONNABORTED' ? '解析超时，请减少页数或稍后重试' : '解析失败，请检查文件后重试'));
        } finally { if (request.current === controller) setBusy(false); }
    };
    const apply = () => {
        const paragraphs = text.trim() ? text.split(/\r?\n/).map((line) => `<p>${escapeHtml(line) || '<br>'}</p>`).join('') : '';
        const image = keepImage && result?.imageDataUrl ? `<p><img src="${result.imageDataUrl}" alt="${escapeHtml(result.filename)}"></p>` : '';
        if (onImport({ title: title.trim(), html: paragraphs + image, replace: mode === 'replace' }) === false) return;
        setApplied(true);
    };
    return <section className="document-import" aria-labelledby="import-heading">
        <div className="import-heading"><span><AppIcon name="document" size={26} accent="#A9BED3" /></span><div><h2 id="import-heading">从文件导入</h2><p>Word、PDF、图片或文本，先检查解析结果，再放入编辑器。</p></div></div>
        <label className="import-picker" htmlFor="knowledge-import-file"><AppIcon name="add" size={24} accent="#EFD46D" /><span>{file ? file.name : '选择文件'}<small>DOCX / PDF / JPG / PNG / TXT / MD · 最多10MB</small></span><input id="knowledge-import-file" type="file" accept=".docx,.pdf,.jpg,.jpeg,.png,.txt,.md" disabled={busy || disabled} onChange={(e) => selectFile(e.target.files?.[0])} /></label>
        <div className="import-options">
            {isImage && <label><input type="checkbox" checked={imageOnly} disabled={busy || disabled} onChange={(e) => setImageOnly(e.target.checked)} />图片仅作为配图，不识别文字</label>}
            <label><input type="checkbox" checked={allowOcr} disabled={busy || disabled || (imageOnly && isImage)} onChange={(e) => setAllowOcr(e.target.checked)} />允许将图片或扫描页发送到百度OCR识别</label>
            <small>文字型Word/PDF在服务器本地解析。OCR需已开通接口权限和额度；最多20页PDF，其中扫描页最多5页。配图模式不适用于扫描PDF。</small>
        </div>
        <div className="import-actions"><button type="button" disabled={!file || busy || disabled} onClick={parse}><AppIcon name={busy ? 'loading' : 'document'} size={18} accent="#A9BED3" />{busy ? '正在解析，请稍候…' : '解析并预览'}</button>{busy && <button type="button" onClick={() => { request.current?.abort(); setBusy(false); }}>取消等待</button>}</div>
        {error && <p className="import-error" role="alert"><AppIcon name="error" size={18} />{error}</p>}
        {result && <div className="import-preview">
            <div className="import-meta"><strong>解析预览</strong><span>{result.pages}页 · {text.length.toLocaleString()}字符{result.usedOcr ? ' · 已使用OCR' : ''}</span></div>
            {result.warnings?.length > 0 && <ul className="import-warnings">{result.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
            <label htmlFor="import-title">文件标题（仅在知识点标题为空时填入）</label><input id="import-title" value={title} maxLength={255} onChange={(e) => { setTitle(e.target.value); setApplied(false); }} />
            <label htmlFor="import-text">正文预览，可直接修正</label><textarea id="import-text" value={text} maxLength={100000} rows={9} onChange={(e) => { setText(e.target.value); setApplied(false); }} />
            {result.imageDataUrl && <div className="import-image"><img src={result.imageDataUrl} alt="待导入的图片预览" /><label><input type="checkbox" checked={keepImage} onChange={(e) => { setKeepImage(e.target.checked); setApplied(false); }} />同时保留压缩配图</label></div>}
            <fieldset className="import-mode"><legend>导入方式</legend><label><input type="radio" name="import-mode" checked={mode === 'append'} onChange={() => setMode('append')} />追加到已有正文</label><label><input type="radio" name="import-mode" checked={mode === 'replace'} onChange={() => setMode('replace')} />替换已有正文</label></fieldset>
            <button type="button" disabled={disabled || applied || (!text.trim() && !(keepImage && result.imageDataUrl))} onClick={apply}>{applied ? '已放入编辑器' : '确认放入编辑器'}</button>
            <small className="import-save-note" role="status">{applied ? '请检查下方编辑器，点击页面底部保存按钮才会保存为知识点。' : '原文件不会永久保存。导入后仍可在下方编辑器继续修改。'}</small>
        </div>}
    </section>;
}
