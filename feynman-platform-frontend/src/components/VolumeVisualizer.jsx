// src/components/VolumeVisualizer.jsx
import React from 'react';

/**
 * VolumeVisualizer 组件
 * 实时显示录音音量的可视化指示器 - 波形样式
 * @param {number} volume - 音量级别 (0-1)
 * @param {string} status - 录音状态 ('idle' | 'recording' | 'paused')
 */
function VolumeVisualizer({ volume = 0, status = 'idle' }) {
  const isActive = status === 'recording';
  const volumePercent = Math.round(volume * 100);
  
  // 根据音量级别设置颜色
  const getVolumeColor = () => {
    if (!isActive) return '#9ca3af';
    if (volume < 0.3) return '#10b981'; // 绿色 - 低音量
    if (volume < 0.7) return '#f59e0b'; // 橙色 - 中音量
    return '#ef4444'; // 红色 - 高音量
  };
  
  // 生成波形条 (12个)
  const bars = Array.from({ length: 12 }, (_, i) => {
    // 使用音量 + 索引偏移创建波形效果
    const baseHeight = isActive ? 20 : 8;
    const offset = Math.sin((i / 12) * Math.PI * 2 + volume * 10) * 0.5 + 0.5;
    const height = baseHeight + (isActive ? volume * 40 * offset : 0);
    return Math.max(4, Math.min(60, height)); // 限制在 4-60px
  });

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      padding: '8px 12px',
      background: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)',
      borderRadius: '12px',
      border: `2px solid ${isActive ? getVolumeColor() : '#d1d5db'}`,
      transition: 'border-color 0.3s ease',
      boxShadow: isActive ? `0 0 20px ${getVolumeColor()}40` : 'none'
    }}>
      {/* 状态指示灯 */}
      <div style={{
        width: '12px',
        height: '12px',
        borderRadius: '50%',
        background: isActive ? getVolumeColor() : '#9ca3af',
        boxShadow: isActive ? `0 0 12px ${getVolumeColor()}` : 'none',
        animation: isActive ? 'pulse 1.5s ease-in-out infinite' : 'none'
      }} />
      
      {/* 波形可视化 */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '3px',
        height: '60px'
      }}>
        {bars.map((height, i) => (
          <div
            key={i}
            style={{
              width: '4px',
              height: `${height}px`,
              background: isActive 
                ? `linear-gradient(180deg, ${getVolumeColor()} 0%, ${getVolumeColor()}80 100%)`
                : '#d1d5db',
              borderRadius: '2px',
              transition: 'height 0.15s ease-out, background 0.3s ease',
              boxShadow: isActive && volume > 0.5 ? `0 0 8px ${getVolumeColor()}60` : 'none'
            }}
          />
        ))}
      </div>
      
      {/* 音量百分比 */}
      <span style={{ 
        fontSize: '0.9rem', 
        fontWeight: '600',
        color: isActive ? getVolumeColor() : '#6b7280',
        minWidth: '50px',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        transition: 'color 0.3s ease'
      }}>
        {volumePercent}%
      </span>
      
      {/* CSS 脉冲动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
        }
      `}</style>
    </div>
  );
}

export default VolumeVisualizer;
