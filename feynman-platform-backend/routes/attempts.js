/**
 * routes/attempts.js
 *
 * 说明：复述记录的保存与查询（旧版，支持分步保存）。
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FeynmanAttempt = require('../models/FeynmanAttempt');
const KnowledgePoint = require('../models/KnowledgePoint');

// POST /api/attempts - 保存一次复述/评价结果（分步保存）
router.post('/', auth, async (req, res) => {
    try {
        const { knowledgePointId, transcribedText, polishedText, score, feedback, standardAnswer, durationMs } = req.body || {};

        if (!knowledgePointId) {
            return res.status(400).json({ msg: 'knowledgePointId 为必填项' });
        }
        if (!transcribedText && !polishedText) {
            return res.status(400).json({ msg: 'transcribedText 和 polishedText 至少提供一项' });
        }

        const kp = await KnowledgePoint.findById(knowledgePointId);
        if (!kp) {
            return res.status(404).json({ msg: 'Knowledge point not found' });
        }
        if (kp.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const attempt = await FeynmanAttempt.create({
            knowledgePoint: knowledgePointId,
            author: req.user.id,
            transcribedText: transcribedText ? String(transcribedText).trim() : '',
            polishedText: polishedText ? String(polishedText).trim() : '',
            standardAnswer: standardAnswer ? String(standardAnswer) : '',
            score: typeof score === 'number' ? score : null,
            feedback: feedback ? String(feedback) : '',
            durationMs: typeof durationMs === 'number' ? durationMs : null
        });

        res.json(attempt);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 可选：GET /api/attempts/:kpId - 按知识点获取当前用户的复述列表
router.get('/:kpId', auth, async (req, res) => {
    try {
        const kp = await KnowledgePoint.findById(req.params.kpId);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const attempts = await FeynmanAttempt.find({
            knowledgePoint: req.params.kpId,
            author: req.user.id
        }).sort({ createdAt: -1 });

        res.json(attempts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;


