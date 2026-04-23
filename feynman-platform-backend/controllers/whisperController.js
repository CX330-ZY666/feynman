/**
 * controllers/whisperController.js
 *
 * 说明：调用本地 Whisper 服务进行语音转写，并内置简单降级机制。
 */
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// 失败计数器和降级状态（连续失败多次后降级到百度 API）
let failureCount = 0;
const MAX_FAILURES = 3;
let isDegraded = false;

/**
 * 重置失败计数器
 */
function resetFailureCount() {
  failureCount = 0;
  if (isDegraded) {
    isDegraded = false;
    console.log('✅ Whisper 服务已恢复，重置降级状态');
  }
}

/**
 * 增加失败计数
 * @returns {boolean} 是否应该降级
 */
function incrementFailureCount() {
  failureCount++;
  console.log(`⚠️  Whisper 失败计数: ${failureCount}/${MAX_FAILURES}`);
  
  if (failureCount >= MAX_FAILURES && !isDegraded) {
    isDegraded = true;
    console.error(`🚨 Whisper 连续失败 ${MAX_FAILURES} 次，自动降级到百度 API`);
    return true;
  }
  
  return isDegraded;
}

/**
 * 获取降级状态
 * @returns {Object} { isDegraded, failureCount, maxFailures }
 */
function getDegradationStatus() {
  return {
    isDegraded,
    failureCount,
    maxFailures: MAX_FAILURES
  };
}

/**
 * 使用本地 Whisper 服务转录音频
 * @param {Object} req - Express 请求对象
 * @param {Object} req.file - multer 上传的音频文件
 * @param {Object} res - Express 响应对象
 * @returns {Object} JSON 响应 { text, device, model, transcribe_time }
 */
exports.transcribeAudioLocal = async (req, res) => {
  try {
    // 0. 检查降级状态
    if (isDegraded) {
      console.log('⚠️  Whisper 已降级，建议使用百度 API');
      return res.status(503).json({
        msg: 'Whisper 服务已降级',
        error: `Whisper 连续失败 ${MAX_FAILURES} 次，已自动切换到百度 API`,
        suggestion: '请使用百度 API 端点 /api/audio/transcribe',
        errorType: 'SERVICE_DEGRADED',
        degradationStatus: getDegradationStatus()
      });
    }

    // 1. 验证文件存在
    if (!req.file) {
      return res.status(400).json({
        msg: '未上传音频文件'
      });
    }

    console.log(`🎙️  收到 Whisper 转录请求: ${req.file.originalname} (${req.file.size} bytes)`);

    // 2. 读取音频文件并创建 FormData
    const formData = new FormData();
    formData.append('audio', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype
    });

    // 3. 调用 Whisper API
    const whisperApiUrl = process.env.WHISPER_API_URL || 'http://localhost:5001';
    const startTime = Date.now();
    
    console.log(`📤 调用 Whisper API: ${whisperApiUrl}/transcribe`);
    const response = await axios.post(
      `${whisperApiUrl}/transcribe`,
      formData,
      {
        headers: formData.getHeaders(),
        timeout: 60000 // 60秒超时
      }
    );

    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ Whisper 转录成功 (耗时 ${elapsedTime}s)`);

    // 成功时重置失败计数
    resetFailureCount();

    // 4. 返回转录结果
    // Whisper API 返回的字段是 'result', 不是 'text'
    const transcribedText = response.data.result || response.data.text || '';
    
    console.log(`📝 转录文本: ${transcribedText.substring(0, 50)}${transcribedText.length > 50 ? '...' : ''}`);
    
    return res.json({
      text: transcribedText,
      result: transcribedText,  // 兼容百度 API 格式
      device: response.data.device,
      model: response.data.model,
      transcribe_time: response.data.transcribe_time,
      total_time: parseFloat(elapsedTime)
    });

  } catch (error) {
    console.error('❌ Whisper 转录失败:', error.message);

    // 网络错误或连接失败
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return res.status(503).json({
        msg: 'Whisper 服务不可用',
        error: 'Whisper API 服务未启动或无法连接',
        suggestion: shouldDegrade ? '已自动降级到百度 API，请使用 /api/audio/transcribe' : '请检查 Whisper 服务是否在运行 (http://localhost:5001)',
        errorType: 'SERVICE_UNAVAILABLE',
        degradationStatus: getDegradationStatus()
      });
    }

    // 超时错误
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      return res.status(504).json({
        msg: 'Whisper 服务超时',
        error: '转录请求超时，可能音频文件过大',
        suggestion: shouldDegrade ? '已自动降级到百度 API，请使用 /api/audio/transcribe' : '请尝试较短的音频片段或稍后重试',
        errorType: 'TIMEOUT',
        degradationStatus: getDegradationStatus()
      });
    }

    // HTTP 错误响应
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;

      // 503 Service Busy - 并发限制
      if (status === 503) {
        return res.status(503).json({
          msg: 'Whisper 服务繁忙',
          error: data.error || '服务并发请求已达上限',
          suggestion: shouldDegrade ? '已自动降级到百度 API，请使用 /api/audio/transcribe' : (data.suggestion || '请稍后重试'),
          errorType: 'SERVICE_BUSY',
          degradationStatus: getDegradationStatus()
        });
      }

      // 400 Bad Request - 音频格式错误
      if (status === 400) {
        return res.status(400).json({
          msg: '音频格式错误',
          error: data.error || '不支持的音频格式',
          suggestion: data.suggestion || '请上传 WAV/MP3/M4A 格式音频',
          errorType: data.error_type || 'INVALID_AUDIO'
        });
      }

      // 500 Internal Server Error - Whisper 内部错误
      if (status === 500) {
        return res.status(500).json({
          msg: 'Whisper 服务内部错误',
          error: data.error || 'Whisper 转录失败',
          suggestion: shouldDegrade ? '已自动降级到百度 API，请使用 /api/audio/transcribe' : (data.suggestion || '请检查音频质量或稍后重试'),
          errorType: data.error_type || 'WHISPER_ERROR',
          degradationStatus: getDegradationStatus()
        });
      }

      // 其他 HTTP 错误
      return res.status(status).json({
        msg: 'Whisper 服务错误',
        error: data.error || error.message,
        errorType: 'HTTP_ERROR',
        statusCode: status
      });
    }

    // 未知错误
    return res.status(500).json({
      msg: '转录失败',
      error: error.message,
      errorType: 'UNKNOWN_ERROR',
      degradationStatus: getDegradationStatus()
    });
  }
};

/**
 * 导出降级状态查询接口（用于健康检查）
 */
exports.getWhisperStatus = (req, res) => {
  return res.json({
    status: isDegraded ? 'degraded' : 'healthy',
    ...getDegradationStatus(),
    whisperApiUrl: process.env.WHISPER_API_URL || 'http://localhost:5001'
  });
};
