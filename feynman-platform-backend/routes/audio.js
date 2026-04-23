/**
 * routes/audio.js
 *
 * 说明：音频上传与语音识别相关路由，支持百度 API 与 Whisper 本地服务。
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const auth = require('../middleware/auth');
// 引入百度AI的控制器
const { transcribeAudio, evaluateFeynmanAttempt } = require('../controllers/baiduAiController');
// 引入Whisper控制器
const { transcribeAudioLocal, getWhisperStatus } = require('../controllers/whisperController');

// 配置multer - 百度API使用内存存储
const uploadMemory = multer({ storage: multer.memoryStorage() });

// 配置multer - Whisper使用磁盘存储（需要文件路径）
const uploadDisk = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, 'uploads/'); // 确保此目录存在
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB 限制
});

// @route   POST /api/audio/transcribe
// @desc    上传音频并进行语音识别（百度API）
// @access  Private
router.post(
    '/transcribe',
    auth,
    uploadMemory.single('audio'), // 'audio' 必须和前端 FormData.append 的字段名一致
    transcribeAudio // 将主要逻辑放到Controller中
);

// @route   POST /api/audio/transcribe-local
// @desc    上传音频并使用本地Whisper进行语音识别
// @access  Private
router.post(
    '/transcribe-local',
    auth,
    uploadDisk.single('audio'),
    transcribeAudioLocal
);

// @route   GET /api/audio/whisper-status
// @desc    获取Whisper服务状态（健康检查）
// @access  Private
router.get(
    '/whisper-status',
    auth,
    getWhisperStatus
);

// @route   POST /api/audio/evaluate
// @desc    AI评价费曼复述
// @access  Private
router.post(
    '/evaluate',
    auth,
    evaluateFeynmanAttempt
);

module.exports = router;

