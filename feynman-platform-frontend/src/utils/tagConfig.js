// src/utils/tagConfig.js

// 预设标签配置
export const PRESET_TAGS = [
  { name: '前端', color: '#3b82f6', icon: '💻' },
  { name: '后端', color: '#10b981', icon: '⚙️' },
  { name: '数据库', color: '#f59e0b', icon: '🗄️' },
  { name: 'AI', color: '#ec4899', icon: '🤖' },
  { name: '算法', color: '#6366f1', icon: '🧠' },
  { name: '设计', color: '#06b6d4', icon: '🎨' },
  { name: '项目', color: '#84cc16', icon: '📁' },
  { name: '合同', color: '#8b5cf6', icon: '📜' },
  { name: '学习', color: '#14b8a6', icon: '📚' },
  { name: '工作', color: '#f97316', icon: '💼' },
  { name: '生活', color: '#ef4444', icon: '🏠' },
  { name: '其他', color: '#6b7280', icon: '📌' },
];

// 可选颜色池（鲜艳多彩的颜色）
export const COLOR_POOL = [
  '#3b82f6', // 蓝色
  '#10b981', // 绿色
  '#f59e0b', // 橙色
  '#ec4899', // 粉色
  '#6366f1', // 靛蓝
  '#06b6d4', // 青色
  '#84cc16', // 黄绿
  '#8b5cf6', // 紫色
  '#14b8a6', // 青绿
  '#f97316', // 深橙
  '#ef4444', // 红色
  '#a855f7', // 紫罗兰
  '#22c55e', // 亮绿
  '#f43f5e', // 玫红
  '#eab308', // 金黄
  '#f472b6', // 粉紫
  '#fb923c', // 浅橙
  '#38bdf8', // 天蓝
];

// 可选图标池（各种常用图标）
export const ICON_POOL = [
  '🏷️', '⭐', '🎯', '🔥', '💡', '🚀', '✨', '🎨',
  '📌', '🎪', '🎭', '🎬', '🎮', '🎲', '🔖', '📎',
  '📍', '🔔', '⚡', '💎', '🌟', '🎉', '🏆', '🎖️',
  '🥇', '🏅', '🎗️', '🎺', '🎸', '🎻', '🎤', '🎧',
  '🎼', '🎹', '🥁', '🎷', '🎶', '🎵', '🔰', '💫',
  '🌈', '🦄', '🍀', '🌺', '🌸', '🌼', '🌻', '🌷',
];

// LocalStorage 键名
const CUSTOM_TAGS_KEY = 'custom_tags_config';

// 随机选择颜色
export const getRandomColor = () => {
  return COLOR_POOL[Math.floor(Math.random() * COLOR_POOL.length)];
};

// 随机选择图标
export const getRandomIcon = () => {
  return ICON_POOL[Math.floor(Math.random() * ICON_POOL.length)];
};

// 从 LocalStorage 加载自定义标签配置
export const loadCustomTags = () => {
  try {
    const saved = localStorage.getItem(CUSTOM_TAGS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch (error) {
    console.error('加载自定义标签配置失败:', error);
    return {};
  }
};

// 保存自定义标签配置到 LocalStorage
export const saveCustomTags = (customTags) => {
  try {
    localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(customTags));
  } catch (error) {
    console.error('保存自定义标签配置失败:', error);
  }
};

// 根据标签名获取配置（支持自定义标签）
export const getTagConfig = (tagName) => {
  // 先查找预设标签
  const presetTag = PRESET_TAGS.find(t => t.name === tagName);
  if (presetTag) return presetTag;
  
  // 再查找自定义标签
  const customTags = loadCustomTags();
  if (customTags[tagName]) {
    return customTags[tagName];
  }
  
  // 如果都没有，返回默认配置
  return { name: tagName, color: '#6b7280', icon: '🏷️' };
};
