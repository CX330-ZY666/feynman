/**
 * scripts/rebuild-vector-store.js
 *
 * 说明：CLI 脚本，将数据库中所有知识点批量写入向量库（用于 RAG 检索）。
 * 用法：node scripts/rebuild-vector-store.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const KnowledgePoint = require('../models/KnowledgePoint');
const { addKnowledgePointToStore } = require('../services/vectorStoreService');

async function rebuildVectorStore() {
  try {
    // 连接数据库
    await mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/feynman-platform');
    console.log('✅ MongoDB 连接成功');

    // 获取所有知识点
    const knowledgePoints = await KnowledgePoint.find({});
    console.log(`📚 找到 ${knowledgePoints.length} 个知识点`);

    if (knowledgePoints.length === 0) {
      console.log('⚠️ 没有知识点需要索引');
      process.exit(0);
    }

    // 逐个添加到向量库
    for (let i = 0; i < knowledgePoints.length; i++) {
      const kp = knowledgePoints[i];
      console.log(`\n[${i + 1}/${knowledgePoints.length}] 处理: ${kp.title || kp._id}`);
      
      try {
        await addKnowledgePointToStore(kp);
        console.log(`✅ 成功索引: ${kp.title || kp._id}`);
      } catch (error) {
        console.error(`❌ 索引失败: ${kp.title || kp._id}`, error.message);
      }
    }

    console.log('\n🎉 向量库重建完成！');
    process.exit(0);

  } catch (error) {
    console.error('❌ 错误:', error);
    process.exit(1);
  }
}

rebuildVectorStore();
