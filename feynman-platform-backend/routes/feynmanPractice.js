/**
 * routes/feynmanPractice.js
 *
 * 说明：费曼练习流程（AI 学生对话、薄弱点管理、练习总结）。
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  askQuestion,
  saveWeakPoint,
  resolveWeakPoint,
  getSummary,
  evaluateUnderstanding
} = require('../controllers/feynmanPracticeController');

// @route   POST /api/feynman-practice/ask
// @desc    AI学生提问
// @access  Private
router.post('/ask', auth, askQuestion);

// @route   POST /api/feynman-practice/evaluate-understanding
// @desc    评估用户理解度
// @access  Private
router.post('/evaluate-understanding', auth, evaluateUnderstanding);

// @route   POST /api/feynman-practice/save-weak-point
// @desc    保存薄弱点
// @access  Private
router.post('/save-weak-point', auth, saveWeakPoint);

// @route   PUT /api/feynman-practice/resolve-weak-point
// @desc    切换薄弱点解决状态
// @access  Private
router.put('/resolve-weak-point', auth, resolveWeakPoint);

// @route   POST /api/feynman-practice/summary
// @desc    获取练习总结
// @access  Private
router.post('/summary', auth, getSummary);

module.exports = router;
