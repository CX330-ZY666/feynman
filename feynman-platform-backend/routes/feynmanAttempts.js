/**
 * routes/feynmanAttempts.js
 *
 * 说明：简化版费曼复述记录（新版前端使用），只存储 transcribedText。
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FeynmanAttempt = require('../models/FeynmanAttempt');
const KnowledgePoint = require('../models/KnowledgePoint');

// POST /api/feynman-attempts - 按前端约定接受 { knowledgePointId, text }
router.post('/', auth, async (req, res) => {
    try {
        const { knowledgePointId, text, durationSeconds } = req.body || {};

        if (!knowledgePointId || !text || !String(text).trim()) {
            return res.status(400).json({ msg: 'knowledgePointId 和 text 为必填项' });
        }

        const kp = await KnowledgePoint.findById(knowledgePointId);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }

        const attempt = await FeynmanAttempt.create({
            knowledgePoint: knowledgePointId,
            author: req.user.id,
            transcribedText: String(text).trim(),
            durationSeconds: typeof durationSeconds === 'number' ? durationSeconds : null
        });

        return res.json({
            id: attempt._id,
            knowledgePointId,
            text: attempt.transcribedText,
            durationSeconds: attempt.durationSeconds,
            createdAt: attempt.createdAt
        });
    } catch (err) {
        console.error(err.message);
        return res.status(500).send('Server Error');
    }
});

// GET /api/feynman-attempts/:kpId - 返回精简结构列表
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

        return res.json(attempts.map(a => ({
            id: a._id,
            knowledgePointId: a.knowledgePoint,
            text: a.transcribedText,
            createdAt: a.createdAt
        })));
    } catch (err) {
        console.error(err.message);
        return res.status(500).send('Server Error');
    }
});

module.exports = router;


