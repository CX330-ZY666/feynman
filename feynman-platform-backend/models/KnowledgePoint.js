const mongoose = require('mongoose');

const KnowledgePointSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        required: true
    },
    category: {
        type: String,
        required: false,
        trim: true,
        default: 'general'
    },
    tags: [{
        type: String,
        trim: true
    }],
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    difficulty: {
        type: String,
        enum: ['beginner', 'intermediate', 'advanced'],
        default: 'beginner'
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    views: {
        type: Number,
        default: 0
    },
    likes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    // 学习状态字段：配合知识图谱颜色使用（例如 mastered / learning / reviewing）
    status: {
        type: String,
        enum: ['learning', 'mastered', 'reviewing'],
        default: 'learning',
        index: true
    },
    // 复习标记字段：true 表示需要复习
    reviewList: {
        type: Boolean,
        default: false,
        index: true  // 添加索引,方便查询需复习的知识点
    },
    // 薄弱点记录
    weakPoints: [{
        content: {
            type: String,
            required: true
        },
        resolved: {
            type: Boolean,
            default: false
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],
    // 注：关系数据使用独立的 KnowledgeRelation 模型存储
}, {
    timestamps: true 
});

module.exports = mongoose.model('KnowledgePoint', KnowledgePointSchema);

