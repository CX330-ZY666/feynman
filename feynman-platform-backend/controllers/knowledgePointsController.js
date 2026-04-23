// controllers/knowledgePointsController.js

const KnowledgePoint = require('../models/KnowledgePoint');

/**
 * 更新知识点学习状态（learning / mastered / reviewing）
 * @route PUT /api/knowledge-points/:id/status
 * @access Private
 */
exports.updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const ALLOWED = ['learning', 'mastered', 'reviewing'];
  if (!ALLOWED.includes(status)) {
    return res.status(400).json({ msg: 'Invalid status value' });
  }

  try {
    const knowledgePoint = await KnowledgePoint.findById(id);

    if (!knowledgePoint) {
      return res.status(404).json({ msg: 'Knowledge point not found' });
    }

    if (knowledgePoint.author.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to update this knowledge point' });
    }

    knowledgePoint.status = status;
    await knowledgePoint.save();

    res.json({
      msg: 'Status updated successfully',
      knowledgePoint,
    });
  } catch (error) {
    console.error('更新学习状态失败:', error);

    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Knowledge point not found' });
    }

    res.status(500).json({
      msg: 'Failed to update status',
      error: error.message,
    });
  }
};

/**
 * 更新知识点复习状态
 * @route PUT /api/knowledge-points/:id/review
 * @access Private
 */
exports.updateReviewStatus = async (req, res) => {
  const { id } = req.params;
  const { reviewList } = req.body;

  // 参数验证
  if (typeof reviewList !== 'boolean') {
    return res.status(400).json({ msg: 'reviewList must be a boolean value' });
  }

  try {
    // 查找知识点
    const knowledgePoint = await KnowledgePoint.findById(id);

    if (!knowledgePoint) {
      return res.status(404).json({ msg: 'Knowledge point not found' });
    }

    // 权限验证:只有作者可以更新
    if (knowledgePoint.author.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'Not authorized to update this knowledge point' });
    }

    // 更新reviewList字段
    knowledgePoint.reviewList = reviewList;
    await knowledgePoint.save();

    console.log(`✅ 知识点 ${id} 复习状态更新为: ${reviewList}`);

    res.json({
      msg: 'Review status updated successfully',
      knowledgePoint
    });

  } catch (error) {
    console.error('❌ 更新复习状态失败:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({ msg: 'Knowledge point not found' });
    }
    
    res.status(500).json({ 
      msg: 'Failed to update review status',
      error: error.message 
    });
  }
};
