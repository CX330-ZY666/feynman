// src/components/LocalVoiceRecorder.jsx
import { useState, useRef } from 'react';

/**
 * LocalVoiceRecorder 组件
 * 使用浏览器原生 Web Speech API 进行本地语音识别
 * 无需后端，适合在新建表单中使用
 * @param {Function} onTranscribeComplete - 转文字完成后的回调 (text) => void
 */
function LocalVoiceRecorder({ onTranscribeComplete }) {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState('');
  const [interim, setInterim] = useState(''); // 临时识别结果
  const [error, setError] = useState('');
  const recognitionRef = useRef(null);

  const startListening = () => {
    setError('');
    try {
      // 先清理旧的实例
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.warn('清理旧识别实例失败:', e);
        }
        recognitionRef.current = null;
      }

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError('你的浏览器不支持语音识别功能，请尝试使用 Chrome、Edge 或 Safari');
        return;
      }

      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;

      // 配置
      recognition.continuous = true; // 持续识别，不会因为没有声音而停止
      recognition.interimResults = true; // 显示临时结果
      recognition.lang = 'zh-CN'; // 中文

      recognition.onstart = () => {
        setIsListening(true);
        setInterim('');
        setTranscribedText('');
        setError('');
      };

      recognition.onresult = (event) => {
        let interim_transcript = '';
        let final_transcript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;

          if (event.results[i].isFinal) {
            final_transcript += transcript + ' ';
          } else {
            interim_transcript += transcript;
          }
        }

        setInterim(interim_transcript);

        if (final_transcript) {
          const combined = transcribedText + final_transcript;
          setTranscribedText(combined.trim());
        }
      };

      recognition.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        
        // no-speech 错误不应该停止识别，只是提示
        if (event.error === 'no-speech') {
          setError('正在等待语音输入...');
          // 不设置 setIsListening(false)，让它继续监听
          return;
        }
        
        let errorMsg = '语音识别失败';
        if (event.error === 'network') {
          errorMsg = '网络错误，请检查网络连接';
        } else if (event.error === 'aborted') {
          errorMsg = '识别被中止';
        }
        setError(errorMsg);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        setInterim('');
      };

      recognition.start();
    } catch (err) {
      console.error('启动语音识别失败:', err);
      setError(`启动语音识别失败: ${err.message || '未知错误'}`);
      setIsListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('停止识别失败:', e);
      }
      setIsListening(false);
      recognitionRef.current = null;
    }
  };

  const handleSaveText = () => {
    const text = (transcribedText + ' ' + interim).trim();
    if (text) {
      if (onTranscribeComplete) {
        onTranscribeComplete(text);
      }
    }
  };

  const handleClear = () => {
    setTranscribedText('');
    setInterim('');
  };

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '6px', background: '#f9f9f9' }}>
      <h3>🎙️ 语音输入</h3>

      {error && (
        <div style={{ padding: '8px', marginBottom: '12px', background: '#fee', border: '1px solid #fcc', borderRadius: '4px', color: '#c33' }}>
          ⚠️ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={startListening}
          disabled={isListening}
          style={{
            background: isListening ? '#999' : '#2ecc71',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: isListening ? 'not-allowed' : 'pointer',
          }}
        >
          {isListening ? '🔴 正在收听...' : '🎙️ 开始说话'}
        </button>
        <button
          type="button"
          onClick={stopListening}
          disabled={!isListening}
          style={{
            background: isListening ? '#f39c12' : '#999',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: isListening ? 'pointer' : 'not-allowed',
          }}
        >
          停止
        </button>
      </div>

      {/* 显示临时和最终结果 */}
      <div style={{ marginBottom: 12 }}>
        <label>识别结果：</label>
        <div
          style={{
            width: '100%',
            minHeight: '60px',
            padding: '8px',
            fontFamily: 'inherit',
            border: '1px solid #ccc',
            borderRadius: '4px',
            background: '#fff',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {transcribedText}
          <span style={{ color: '#999', fontStyle: 'italic' }}>{interim}</span>
        </div>
      </div>

      {/* 按钮组 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={handleSaveText}
          disabled={!transcribedText && !interim}
          style={{
            background: transcribedText || interim ? '#0066cc' : '#bbb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: (transcribedText || interim) ? 'pointer' : 'not-allowed',
          }}
        >
          ✓ 添加到内容
        </button>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: '#999',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            padding: '6px 12px',
            cursor: 'pointer',
          }}
        >
          🗑️ 清空
        </button>
      </div>

      <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
        💡 提示：点击"开始说话"后，请说出你要输入的内容。支持中文语音识别。
      </p>
    </div>
  );
}

export default LocalVoiceRecorder;
