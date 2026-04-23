/**
 * routes/graph.js
 *
 * 说明：知识图谱与 3D 宇宙可视化所需的节点 + 边数据。
 */
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const KnowledgePoint = require('../models/KnowledgePoint');
const KnowledgeRelation = require('../models/KnowledgeRelation');

// @route   GET /api/graph/knowledge-map
// @desc    获取知识图谱数据
// @access  Private
router.get('/knowledge-map', auth, async (req, res) => {
    try {
        // 查询当前用户的所有知识点
        const kps = await KnowledgePoint.find({ author: req.user.id });

        // 处理空数据边界情况
        if (kps.length === 0) {
            return res.json({ nodes: [], links: [] });
        }

        // 将知识点转换为节点对象（包含状态与复习标记，供前端着色使用）
        const nodes = kps.map(kp => ({
            id: kp._id.toString(),
            name: kp.title,
            value: kp.content.substring(0, 100), // 截取前100个字符作为描述
            symbolSize: 20 + Math.min(kp.content.length / 50, 30), // 动态计算节点大小
            status: kp.status, // learning / mastered / reviewing
            reviewList: kp.reviewList,
            difficulty: kp.difficulty,
            createdAt: kp.createdAt
        }));
        const nodeIdSet = new Set(nodes.map((n) => n.id));

        // 实现关系检测算法
        const autoLinks = [];
        const linkSet = new Set(); // 用于去重
        
        // 构建标题到 ID 的映射表
        const kpTitleMap = new Map(kps.map(kp => [kp.title, kp._id.toString()]));

        // 1. 检测自动引用关系（基于内容包含）
        for (const sourceKp of kps) {
            for (const [targetTitle, targetId] of kpTitleMap.entries()) {
                // 避免自引用
                if (sourceKp.title === targetTitle) continue;
                
                // 检查内容中是否包含目标标题
                if (sourceKp.content.includes(targetTitle)) {
                    const sourceId = sourceKp._id.toString();
                    const linkKey = `${sourceId}-${targetId}`;
                    
                    if (!linkSet.has(linkKey)) {
                        autoLinks.push({
                            source: sourceId,
                            target: targetId
                        });
                        linkSet.add(linkKey);
                    }
                }
            }
        }
        
        // 2. 查询手动添加的关系
        const manualRelations = await KnowledgeRelation.find({ author: req.user.id });
        console.log('📊 查询到的手动关系数量:', manualRelations.length);
        console.log('📊 手动关系详情:', JSON.stringify(manualRelations, null, 2));
        
        const manualLinks = manualRelations.map(r => ({
            source: r.source.toString(),
            target: r.target.toString(),
            relationType: r.relationType,
            relationLabel: r.relationLabel
        })).filter((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target));
        console.log('📊 转换后的manualLinks:', JSON.stringify(manualLinks, null, 2));
        
        // 3. 合并所有关系（手动关系优先，去重）
        manualLinks.forEach(link => {
            const key1 = `${link.source}-${link.target}`;
            const key2 = `${link.target}-${link.source}`;
            if (!linkSet.has(key1) && !linkSet.has(key2)) {
                linkSet.add(key1);
            }
        });
        
        const validAutoLinks = autoLinks.filter((link) => nodeIdSet.has(link.source) && nodeIdSet.has(link.target));
        const links = [...manualLinks, ...validAutoLinks];
        
        console.log('🚀 最终返回的数据:');
        console.log('   - 节点数量:', nodes.length);
        console.log('   - 连线数量:', links.length);
        console.log('   - 手动关系:', manualLinks.length);
        console.log('   - 自动关系:', validAutoLinks.length);

        res.json({ nodes, links });
    } catch (error) {
        console.error('Error generating knowledge graph:', error);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/graph/knowledge-universe
// @desc    获取3D知识宇宙数据（整合自动+手动关系）
// @access  Private
router.get('/knowledge-universe', auth, async (req, res) => {
    try {
        const userId = req.user.id;
        
        // 1. 查询用户所有知识点
        const knowledgePoints = await KnowledgePoint.find({ author: userId });
        
        // 处理空数据边界情况
        if (knowledgePoints.length === 0) {
            return res.json({ nodes: [], links: [] });
        }
        
        // 2. 格式化节点数据
        const nodes = knowledgePoints.map(kp => ({
            id: kp._id.toString(),
            title: kp.title,
            content: kp.content,
            category: kp.category,
            tags: kp.tags || [],
            createdAt: kp.createdAt
        }));
        
        // 3. 计算自动关系（基于 category 和 tags）
        const autoLinks = calculateAutoLinks(knowledgePoints);
        
        // 4. 查询手动关系
        const manualRelations = await KnowledgeRelation.find({ author: userId });
        const manualLinks = manualRelations.map(r => ({
            source: r.source.toString(),
            target: r.target.toString(),
            type: 'manual',
            relationLabel: r.relationLabel,
            _id: r._id.toString()
        }));
        
        // 5. 合并所有关系
        const links = [...autoLinks, ...manualLinks];
        
        res.json({ nodes, links });
    } catch (error) {
        console.error('Error generating knowledge universe:', error);
        res.status(500).json({ msg: 'Server Error' });
    }
});

/**
 * 计算自动关系
 * 规则1：相同 category 的节点连接相邻节点（避免完全图）
 * 规则2：拥有共享 tag 的节点互相连接
 */
function calculateAutoLinks(knowledgePoints) {
    const links = [];
    const linkSet = new Set(); // 用于去重
    
    // 规则1：相同 category 的节点连接相邻节点
    const categoryGroups = {};
    knowledgePoints.forEach(kp => {
        const category = kp.category || 'general';
        if (!categoryGroups[category]) {
            categoryGroups[category] = [];
        }
        categoryGroups[category].push(kp);
    });
    
    // 在每个 category 组内创建连接（链式连接，避免完全图）
    for (const [category, nodes] of Object.entries(categoryGroups)) {
        if (nodes.length > 1) {
            for (let i = 0; i < nodes.length - 1; i++) {
                const sourceId = nodes[i]._id.toString();
                const targetId = nodes[i + 1]._id.toString();
                const linkKey = `${sourceId}-${targetId}`;
                
                if (!linkSet.has(linkKey)) {
                    links.push({
                        source: sourceId,
                        target: targetId,
                        type: 'auto'
                    });
                    linkSet.add(linkKey);
                }
            }
        }
    }
    
    // 规则2：共享 tag 的节点互相连接
    for (let i = 0; i < knowledgePoints.length; i++) {
        for (let j = i + 1; j < knowledgePoints.length; j++) {
            const kp1 = knowledgePoints[i];
            const kp2 = knowledgePoints[j];
            
            // 检查是否有共享 tag
            const tags1 = kp1.tags || [];
            const tags2 = kp2.tags || [];
            const sharedTags = tags1.filter(tag => tags2.includes(tag));
            
            if (sharedTags.length > 0) {
                const sourceId = kp1._id.toString();
                const targetId = kp2._id.toString();
                const linkKey = `${sourceId}-${targetId}`;
                
                if (!linkSet.has(linkKey)) {
                    links.push({
                        source: sourceId,
                        target: targetId,
                        type: 'auto'
                    });
                    linkSet.add(linkKey);
                }
            }
        }
    }
    
    return links;
}

module.exports = router;
