const mongoose = require('mongoose');

const FeynmanAttemptSchema = new mongoose.Schema(
  {
    knowledgePoint: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'KnowledgePoint',
      required: true,
      index: true
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    transcribedText: {
      type: String,
      required: true,
      trim: true
    },
    polishedText: {
      type: String,
      default: ''
    },
    standardAnswer: {
      type: String,
      default: ''
    },
    // 可扩展：评分、AI反馈、持续时长、原音频存储地址等
    score: {
      type: Number,
      default: null
    },
    feedback: {
      type: String,
      default: ''
    },
    durationMs: {
      type: Number,
      default: null
    },
    durationSeconds: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeynmanAttempt', FeynmanAttemptSchema);


