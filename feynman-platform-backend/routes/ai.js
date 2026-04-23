// routes/ai.js
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { generateQuestion, gradeAnswer, explainChoice, answerWithRAG, answerWithRAGStream } = require('../controllers/baiduAiController');
const KnowledgePoint = require('../models/KnowledgePoint');
const { addKnowledgePointToStore } = require('../services/vectorStoreService');

// @route   POST /api/ai/generate-question
// @desc    生成题目（单选题或简答题）
// @access  Private
router.post('/generate-question', auth, generateQuestion);

// @route   POST /api/ai/grade-answer
// @desc    AI评判简答题答案
// @access  Private
router.post('/grade-answer', auth, gradeAnswer);

// @route   POST /api/ai/explain-choice
// @desc    AI解析选择题答案（正确原因+错误原因+知识点）
// @access  Private
router.post('/explain-choice', auth, explainChoice);

// @route   POST /api/ai/rag-qa
// @desc    RAG 问答（非流式）
// @access  Private
router.post('/rag-qa', auth, answerWithRAG);

// @route   POST /api/ai/rag-qa-stream
// @desc    RAG 问答（流式）
// @access  Private
router.post('/rag-qa-stream', auth, answerWithRAGStream);

// @route   POST /api/ai/rebuild-vector-store
// @desc    重建向量库（将数据库中所有知识点重新索引）
// @access  Private
router.post('/rebuild-vector-store', auth, async (req, res) => {
  try {
    const knowledgePoints = await KnowledgePoint.find({});
    if (knowledgePoints.length === 0) {
      return res.json({ msg: '没有知识点需要索引', count: 0 });
    }
    // 异步执行，立即返回响应
    res.json({ msg: `开始重建向量库，共 ${knowledgePoints.length} 个知识点，请稍候几分钟后再试问答功能。`, count: knowledgePoints.length });
    // 使用批量重建（带限流延迟）
    const { rebuildVectorStore } = require('../services/vectorStoreService');
    try {
      await rebuildVectorStore(knowledgePoints);
      console.log(`[rebuild] 向量库重建完成，共处理 ${knowledgePoints.length} 个知识点`);
    } catch (e) {
      console.error('[rebuild] 向量库重建失败:', e.message);
    }
    console.log(`[rebuild] 向量库重建完成，共处理 ${knowledgePoints.length} 个知识点`);
  } catch (err) {
    console.error('[rebuild] 重建向量库失败:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ msg: '重建失败', error: err.message });
    }
  }
});

module.exports = router;
