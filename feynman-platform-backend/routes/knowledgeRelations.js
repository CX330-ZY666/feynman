/**
 * routes/knowledgeRelations.js
 *
 * 说明：知识点关系的增删查路由。
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
    createRelation,
    getRelations,
    deleteRelation
} = require('../controllers/knowledgeRelationsController');

// @route   POST /api/relations
// @desc    创建知识点关系
// @access  Private
router.post('/', auth, createRelation);

// @route   GET /api/relations
// @desc    获取用户所有关系
// @access  Private
router.get('/', auth, getRelations);

// @route   DELETE /api/relations/:id
// @desc    删除关系
// @access  Private
router.delete('/:id', auth, deleteRelation);

module.exports = router;
