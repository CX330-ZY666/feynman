/**
 * models/KnowledgeRelation.js
 *
 * 说明：知识点之间的语义关系，用于构建知识图谱。
 */
const mongoose = require('mongoose');

const KnowledgeRelationSchema = new mongoose.Schema({
    source: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgePoint',
        required: true,
        index: true
    },
    target: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'KnowledgePoint',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['auto', 'manual'],
        default: 'manual',
        required: true
    },
    // 语义关系类型（知识图谱核心）
    relationType: {
        type: String,
        enum: [
            'prerequisite',    // 前置知识（source 依赖于 target）
            'derived',         // 派生（source 从 target 派生）
            'similar',         // 相似（概念相似）
            'contrast',        // 对比（形成对比）
            'application',     // 应用（source 应用于 target）
            'includes',        // 包含（source 包含 target）
            'reference'        // 引用（source 引用 target）
        ],
        default: 'reference',
        required: true
    },
    // 关系强度 (0-1)
    strength: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
    },
    // 旧字段，保留向下兼容
    relationLabel: {
        type: String,
        trim: true,
        maxlength: 50
    },
    // 关系说明
    description: {
        type: String,
        trim: true,
        maxlength: 200
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    }
}, { 
    timestamps: true 
});

// 复合唯一索引：防止重复关系
KnowledgeRelationSchema.index({ 
    source: 1, 
    target: 1, 
    author: 1 
}, { unique: true });

// 查询优化索引：提升双向查询性能
KnowledgeRelationSchema.index({ author: 1, source: 1 });
KnowledgeRelationSchema.index({ author: 1, target: 1 });

module.exports = mongoose.model('KnowledgeRelation', KnowledgeRelationSchema);
