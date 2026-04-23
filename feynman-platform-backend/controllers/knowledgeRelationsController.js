/**
 * controllers/knowledgeRelationsController.js
 *
 * 说明：知识点关系的增删查，用于构建知识图谱边数据。
 */
const KnowledgeRelation = require('../models/KnowledgeRelation');
const KnowledgePoint = require('../models/KnowledgePoint');

/**
 * 创建知识点关系
 * @route   POST /api/relations
 * @access  Private
 */
exports.createRelation = async (req, res) => {
    try {
        const { source, target, relationLabel, relationType, strength, description } = req.body;
        const userId = req.user.id;
        
        // 1. 验证参数
        if (!source || !target) {
            return res.status(400).json({ msg: '缺少必要参数：source 和 target 为必填项' });
        }
        
        // 2. 检查自关联
        if (source === target) {
            return res.status(400).json({ msg: '不能关联自己' });
        }
        
        // 3. 验证节点存在且属于当前用户
        const [sourceNode, targetNode] = await Promise.all([
            KnowledgePoint.findOne({ _id: source, author: userId }),
            KnowledgePoint.findOne({ _id: target, author: userId })
        ]);
        
        if (!sourceNode) {
            return res.status(404).json({ msg: '源知识点不存在或无权访问' });
        }
        
        if (!targetNode) {
            return res.status(404).json({ msg: '目标知识点不存在或无权访问' });
        }
        
        // 4. 检查关系是否重复
        const existing = await KnowledgeRelation.findOne({
            source, 
            target, 
            author: userId
        });
        
        if (existing) {
            return res.status(409).json({ msg: '关系已存在' });
        }
        
        // 5. 创建关系记录
        const relation = new KnowledgeRelation({
            source,
            target,
            type: 'manual',
            relationType: relationType || 'reference',  // 默认为引用关系
            strength: strength !== undefined ? strength : 0.5,
            description: description || '',
            relationLabel: relationLabel || '',  // 向下兼容
            author: userId
        });
        
        await relation.save();
        
        // 6. 返回完整数据
        res.json(relation);
    } catch (error) {
        console.error('创建关系失败:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
};

/**
 * 获取用户所有关系
 * @route   GET /api/relations
 * @access  Private
 */
exports.getRelations = async (req, res) => {
    try {
        const relations = await KnowledgeRelation.find({ 
            author: req.user.id 
        }).sort({ createdAt: -1 });
        
        res.json(relations);
    } catch (error) {
        console.error('获取关系失败:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
};

/**
 * 删除关系
 * @route   DELETE /api/relations/:id
 * @access  Private
 */
exports.deleteRelation = async (req, res) => {
    try {
        const relation = await KnowledgeRelation.findById(req.params.id);
        
        if (!relation) {
            return res.status(404).json({ msg: '关系不存在' });
        }
        
        // 验证所有权
        if (relation.author.toString() !== req.user.id) {
            return res.status(401).json({ msg: '无权删除此关系' });
        }
        
        await KnowledgeRelation.findByIdAndDelete(req.params.id);
        res.json({ msg: '关系已删除' });
    } catch (error) {
        console.error('删除关系失败:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
};
