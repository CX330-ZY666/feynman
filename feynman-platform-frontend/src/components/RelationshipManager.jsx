import { useState, useEffect } from 'react';
import apiClient from '../api/axios';

// 关系类型配置
const RELATION_TYPES = [
    { value: 'prerequisite', label: '前置知识', icon: '⬅️', color: '#ff4444', desc: '当前知识点依赖于目标' },
    { value: 'derived', label: '派生', icon: '', color: '#44ff44', desc: '当前知识点从目标派生而来' },
    { value: 'similar', label: '相似', icon: '', color: '#4444ff', desc: '两者概念相似' },
    { value: 'contrast', label: '对比', icon: '⚖️', color: '#ffaa00', desc: '两者形成对比关系' },
    { value: 'application', label: '应用', icon: '', color: '#ff44ff', desc: '当前知识点应用于目标' },
    { value: 'includes', label: '包含', icon: '', color: '#44ffff', desc: '当前知识点包含目标' },
    { value: 'reference', label: '引用', icon: '', color: '#aaaaaa', desc: '当前知识点引用目标' }
];

function RelationshipManager({ currentKpId, onRelationsChange }) {
    const [allKnowledgePoints, setAllKnowledgePoints] = useState([]);
    const [existingRelations, setExistingRelations] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // 添加关系的表单状态
    const [showAddForm, setShowAddForm] = useState(false);
    const [newRelation, setNewRelation] = useState({
        target: '',
        relationType: 'reference',
        strength: 0.5,
        description: ''
    });

    // 加载数据
    useEffect(() => {
        loadData();
    }, [currentKpId]);

    const loadData = async () => {
        try {
            setLoading(true);
            // 获取所有知识点
            const kpRes = await apiClient.get('/knowledge-points');
            const kps = Array.isArray(kpRes.data) ? kpRes.data : (Array.isArray(kpRes.data?.knowledgePoints) ? kpRes.data.knowledgePoints : []);
            setAllKnowledgePoints(kps.filter(kp => kp._id !== currentKpId));
            
            // 获取当前知识点的所有关系
            const relRes = await apiClient.get('/relations');
            const relData = Array.isArray(relRes.data) ? relRes.data : [];
            const relations = relData.filter(
                rel => rel.source === currentKpId || rel.target === currentKpId
            );
            setExistingRelations(relations);
            
            setLoading(false);
        } catch (err) {
            console.error('加载关系数据失败:', err);
            setLoading(false);
        }
    };

    const handleAddRelation = async () => {
        if (!newRelation.target) {
            alert('请选择目标知识点');
            return;
        }

        try {
            await apiClient.post('/relations', {
                source: currentKpId,
                target: newRelation.target,
                relationType: newRelation.relationType,
                strength: parseFloat(newRelation.strength),
                description: newRelation.description
            });

            // 重新加载
            await loadData();
            
            // 重置表单
            setNewRelation({
                target: '',
                relationType: 'reference',
                strength: 0.5,
                description: ''
            });
            setShowAddForm(false);
            
            // 通知父组件
            if (onRelationsChange) onRelationsChange();
        } catch (err) {
            console.error('添加关系失败:', err);
            alert(err.response?.data?.msg || '添加关系失败');
        }
    };

    const handleDeleteRelation = async (relationId) => {
        if (!confirm('确定删除这个关系吗？')) return;

        try {
            await apiClient.delete(`/relations/${relationId}`);
            await loadData();
            if (onRelationsChange) onRelationsChange();
        } catch (err) {
            console.error('删除关系失败:', err);
            alert('删除关系失败');
        }
    };

    const getRelationTypeConfig = (type) => {
        return RELATION_TYPES.find(t => t.value === type) || RELATION_TYPES[6];
    };

    const getKnowledgePointTitle = (kpId) => {
        const kp = allKnowledgePoints.find(k => k._id === kpId);
        return kp ? kp.title : 'Unknown';
    };

    if (loading) {
        return <div style={{ padding: '20px', textAlign: 'center' }}>加载中...</div>;
    }

    return (
        <div style={{
            padding: '20px',
            background: '#f9f9f9',
            borderRadius: '8px',
            border: '1px solid #e0e0e0'
        }}>
            <h3 style={{ marginTop: 0, marginBottom: '15px', color: '#333' }}>
                 关系管理
            </h3>

            {/* 关系类型说明 */}
            <details style={{ marginBottom: '20px' }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', color: '#666' }}>
                     关系类型说明
                </summary>
                <div style={{
                    marginTop: '10px',
                    padding: '10px',
                    background: 'white',
                    borderRadius: '4px',
                    fontSize: '13px'
                }}>
                    {RELATION_TYPES.map(type => (
                        <div key={type.value} style={{ marginBottom: '8px' }}>
                            <span style={{ color: type.color }}>{type.icon}</span>
                            <strong> {type.label}</strong>: {type.desc}
                        </div>
                    ))}
                </div>
            </details>

            {/* 现有关系列表 */}
            <div style={{ marginBottom: '20px' }}>
                <h4 style={{ color: '#555', fontSize: '14px' }}>
                    现有关系 ({existingRelations.length})
                </h4>
                {existingRelations.length === 0 ? (
                    <p style={{ color: '#999', fontSize: '13px' }}>暂无关系</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {existingRelations.map(rel => {
                            const config = getRelationTypeConfig(rel.relationType);
                            const isOutgoing = rel.source === currentKpId;
                            const otherKpId = isOutgoing ? rel.target : rel.source;
                            
                            return (
                                <div key={rel._id} style={{
                                    padding: '12px',
                                    background: 'white',
                                    borderRadius: '6px',
                                    border: `2px solid ${config.color}`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: '13px', marginBottom: '4px' }}>
                                            <span style={{ fontSize: '16px' }}>{config.icon}</span>
                                            <strong style={{ color: config.color, marginLeft: '5px' }}>
                                                {config.label}
                                            </strong>
                                            <span style={{ margin: '0 8px', color: '#999' }}>
                                                {isOutgoing ? '→' : '←'}
                                            </span>
                                            <span style={{ color: '#333' }}>
                                                {getKnowledgePointTitle(otherKpId)}
                                            </span>
                                        </div>
                                        {rel.description && (
                                            <div style={{ fontSize: '12px', color: '#666', marginLeft: '25px' }}>
                                                 {rel.description}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '11px', color: '#999', marginLeft: '25px' }}>
                                            强度: {(rel.strength * 100).toFixed(0)}%
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteRelation(rel._id)}
                                        style={{
                                            background: '#ff4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '4px',
                                            padding: '6px 12px',
                                            cursor: 'pointer',
                                            fontSize: '12px'
                                        }}
                                    >
                                        删除
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 添加关系按钮/表单 */}
            {!showAddForm ? (
                <button
                    onClick={() => setShowAddForm(true)}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: '#4CAF50',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    + 添加新关系
                </button>
            ) : (
                <div style={{
                    padding: '15px',
                    background: 'white',
                    borderRadius: '6px',
                    border: '2px solid #4CAF50'
                }}>
                    <h4 style={{ marginTop: 0, color: '#4CAF50' }}>添加新关系</h4>
                    
                    {/* 选择目标知识点 */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                            目标知识点 *
                        </label>
                        <select
                            value={newRelation.target}
                            onChange={(e) => setNewRelation({ ...newRelation, target: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '13px'
                            }}
                        >
                            <option value="">-- 选择知识点 --</option>
                            {allKnowledgePoints.map(kp => (
                                <option key={kp._id} value={kp._id}>
                                    {kp.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 选择关系类型 */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                            关系类型 *
                        </label>
                        <select
                            value={newRelation.relationType}
                            onChange={(e) => setNewRelation({ ...newRelation, relationType: e.target.value })}
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '13px'
                            }}
                        >
                            {RELATION_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.icon} {type.label} - {type.desc}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 关系强度 */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                            关系强度: {(newRelation.strength * 100).toFixed(0)}%
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={newRelation.strength}
                            onChange={(e) => setNewRelation({ ...newRelation, strength: e.target.value })}
                            style={{ width: '100%' }}
                        />
                    </div>

                    {/* 关系说明 */}
                    <div style={{ marginBottom: '15px' }}>
                        <label style={{ display: 'block', marginBottom: '5px', fontSize: '13px', fontWeight: 'bold' }}>
                            说明（可选）
                        </label>
                        <textarea
                            value={newRelation.description}
                            onChange={(e) => setNewRelation({ ...newRelation, description: e.target.value })}
                            placeholder="描述这个关系..."
                            maxLength="200"
                            style={{
                                width: '100%',
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid #ddd',
                                fontSize: '13px',
                                resize: 'vertical',
                                minHeight: '60px'
                            }}
                        />
                    </div>

                    {/* 操作按钮 */}
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleAddRelation}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                            }}
                        >
                            ✓ 确认添加
                        </button>
                        <button
                            onClick={() => setShowAddForm(false)}
                            style={{
                                flex: 1,
                                padding: '10px',
                                background: '#999',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            取消
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default RelationshipManager;
