// src/components/TagSelector.jsx
import { useState, useEffect } from 'react';
import './TagSelector.css';
import {
  PRESET_TAGS,
  getTagConfig,
  getRandomColor,
  getRandomIcon,
  loadCustomTags,
  saveCustomTags,
} from '../utils/tagConfig';

function TagSelector({ selectedTags = [], onChange }) {
  const [customTag, setCustomTag] = useState('');
  const [customTagsConfig, setCustomTagsConfig] = useState({});

  // 加载自定义标签配置
  useEffect(() => {
    setCustomTagsConfig(loadCustomTags());
  }, []);

  const toggleTag = (tagName) => {
    if (selectedTags.includes(tagName)) {
      onChange(selectedTags.filter(t => t !== tagName));
    } else {
      onChange([...selectedTags, tagName]);
    }
  };

  const addCustomTag = () => {
    const trimmed = customTag.trim();
    if (trimmed && !selectedTags.includes(trimmed)) {
      // 检查是否为新的自定义标签（不在预设和已有自定义中）
      const isPreset = PRESET_TAGS.some(t => t.name === trimmed);
      const isExistingCustom = customTagsConfig[trimmed];
      
      if (!isPreset && !isExistingCustom) {
        // 为新的自定义标签生成随机颜色和图标
        const newConfig = {
          name: trimmed,
          color: getRandomColor(),
          icon: getRandomIcon(),
        };
        
        // 更新自定义标签配置
        const updatedConfig = { ...customTagsConfig, [trimmed]: newConfig };
        setCustomTagsConfig(updatedConfig);
        saveCustomTags(updatedConfig);
      }
      
      onChange([...selectedTags, trimmed]);
      setCustomTag('');
    }
  };

  // 删除自定义标签
  const deleteCustomTag = (tagName) => {
    if (window.confirm(`确定要删除自定义标签「${tagName}」吗？`)) {
      // 从配置中删除
      const updatedConfig = { ...customTagsConfig };
      delete updatedConfig[tagName];
      setCustomTagsConfig(updatedConfig);
      saveCustomTags(updatedConfig);
      
      // 如果当前已选中，也要取消选中
      if (selectedTags.includes(tagName)) {
        onChange(selectedTags.filter(t => t !== tagName));
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addCustomTag();
    }
  };

  // 获取所有自定义标签列表
  const customTagsList = Object.values(customTagsConfig);

  return (
    <div className="tag-selector">
      <div className="tag-selector-label"> 选择标签（可多选）</div>
      
      {/* 预设标签 */}
      <div className="preset-tags">
        {PRESET_TAGS.map(tag => (
          <button
            key={tag.name}
            type="button"
            className={`tag-option ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
            style={{ 
              '--tag-color': tag.color,
              backgroundColor: selectedTags.includes(tag.name) ? tag.color : 'transparent'
            }}
            onClick={() => toggleTag(tag.name)}
          >
            <span className="tag-icon">{tag.icon}</span>
            <span className="tag-name">{tag.name}</span>
            {selectedTags.includes(tag.name) && <span className="tag-check">✓</span>}
          </button>
        ))}
      </div>

      {/* 自定义标签区域 */}
      {customTagsList.length > 0 && (
        <div className="custom-tags-section">
          <div className="custom-tags-label"> 我的自定义标签</div>
          <div className="preset-tags">
            {customTagsList.map(tag => (
              <div key={tag.name} className="custom-tag-wrapper">
                <button
                  type="button"
                  className={`tag-option ${selectedTags.includes(tag.name) ? 'selected' : ''}`}
                  style={{ 
                    '--tag-color': tag.color,
                    backgroundColor: selectedTags.includes(tag.name) ? tag.color : 'transparent'
                  }}
                  onClick={() => toggleTag(tag.name)}
                >
                  <span className="tag-icon">{tag.icon}</span>
                  <span className="tag-name">{tag.name}</span>
                  {selectedTags.includes(tag.name) && <span className="tag-check">✓</span>}
                </button>
                <button
                  type="button"
                  className="delete-custom-tag"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteCustomTag(tag.name);
                  }}
                  title="删除此标签"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 自定义标签输入 */}
      <div className="custom-tag-input">
        <input
          type="text"
          value={customTag}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入自定义标签，按回车添加"
          className="custom-tag-field"
        />
        <button 
          type="button" 
          onClick={addCustomTag}
          className="custom-tag-btn"
          disabled={!customTag.trim()}
        >
          添加
        </button>
      </div>

      {/* 已选标签展示 */}
      {selectedTags.length > 0 && (
        <div className="selected-tags">
          <span className="selected-label">已选：</span>
          {selectedTags.map(tag => {
            const config = getTagConfig(tag);
            return (
              <span 
                key={tag} 
                className="selected-tag"
                style={{ backgroundColor: config.color }}
              >
                {config.icon} {tag}
                <button 
                  type="button"
                  className="remove-tag"
                  onClick={() => toggleTag(tag)}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default TagSelector;
