const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const KnowledgePoint = require('../models/KnowledgePoint');
const KnowledgeRelation = require('../models/KnowledgeRelation');
const { updateReviewStatus, updateStatus } = require('../controllers/knowledgePointsController');
const { addKnowledgePointToStore } = require('../services/vectorStoreService');

// 创建知识点
router.post('/', auth, async (req, res) => {
    try {
        const { title, content, category, tags } = req.body;
        
        const newKp = new KnowledgePoint({
            title,
            content,
            category: category || 'general',
            tags: tags || [],
            author: req.user.id
        });
        
        const kp = await newKp.save();

        // 异步触发向量化处理，不阻塞主请求
        addKnowledgePointToStore(kp);

        res.json(kp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 获取当前用户所有知识点（包含关系数据）
router.get('/', auth, async (req, res) => {
    try {
        const kps = await KnowledgePoint.find({ author: req.user.id }).sort({ createdAt: -1 });
        
        // 获取所有关系（为 3D 可视化提供完整图谱数据）
        const relations = await KnowledgeRelation.find({ author: req.user.id });
        
        res.json({ 
            knowledgePoints: kps,
            relations: relations
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 获取单个知识点详情
router.get('/:id', auth, async (req, res) => {
    try {
        const kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        res.json(kp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 更新知识点
router.put('/:id', auth, async (req, res) => {
    try {
        let kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        const { title, content, status, reviewList, tags } = req.body;

        const oldContent = kp.content;

        const updatedKp = await KnowledgePoint.findByIdAndUpdate(
            req.params.id,
            { $set: { title, content, status, reviewList, tags } },
            { new: true }
        );

        // 内容发生变化时重新索引
        if (updatedKp && updatedKp.content !== oldContent) {
            addKnowledgePointToStore(updatedKp);
        }

        res.json(updatedKp);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 删除知识点
router.delete('/:id', auth, async (req, res) => {
    try {
        let kp = await KnowledgePoint.findById(req.params.id);
        if (!kp) return res.status(404).json({ msg: 'Knowledge point not found' });
        if (kp.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: 'Not authorized' });
        }
        await KnowledgePoint.findByIdAndDelete(req.params.id);
        res.json({ msg: 'Knowledge point removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// 更新知识点学习状态
// @route   PUT /api/knowledge-points/:id/status
// @desc    更新 status 字段
// @access  Private
router.put('/:id/status', auth, updateStatus);

// 更新知识点复习状态
// @route   PUT /api/knowledge-points/:id/review
// @desc    更新 reviewList 字段
// @access  Private
router.put('/:id/review', auth, updateReviewStatus);

module.exports = router;
