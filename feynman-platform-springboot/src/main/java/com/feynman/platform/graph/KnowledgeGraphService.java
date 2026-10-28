package com.feynman.platform.graph;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.feynman.platform.knowledge.KnowledgePointEntity;
import com.feynman.platform.knowledge.KnowledgePointMapper;
import com.feynman.platform.knowledge.KnowledgePointTagEntity;
import com.feynman.platform.knowledge.KnowledgePointTagMapper;
import com.feynman.platform.relation.KnowledgeRelationEntity;
import com.feynman.platform.relation.KnowledgeRelationMapper;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

@Service
public class KnowledgeGraphService {
    private final KnowledgePointMapper pointMapper;
    private final KnowledgePointTagMapper tagMapper;
    private final KnowledgeRelationMapper relationMapper;

    public KnowledgeGraphService(
            KnowledgePointMapper pointMapper,
            KnowledgePointTagMapper tagMapper,
            KnowledgeRelationMapper relationMapper
    ) {
        this.pointMapper = pointMapper;
        this.tagMapper = tagMapper;
        this.relationMapper = relationMapper;
    }

    public GraphResponse knowledgeMap(String userId) {
        List<KnowledgePointEntity> points = loadPoints(userId);
        if (points.isEmpty()) return GraphResponse.empty();

        List<Map<String, Object>> nodes = points.stream().map(point -> {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", point.getId());
            node.put("name", point.getTitle());
            node.put("value", abbreviate(point.getContent(), 100));
            node.put("symbolSize", 20d + Math.min(point.getContent().length() / 50d, 30d));
            node.put("status", point.getStatus());
            node.put("reviewList", point.getReviewList());
            node.put("difficulty", point.getDifficulty());
            node.put("createdAt", point.getCreatedAt());
            return node;
        }).toList();

        Set<String> nodeIds = points.stream().map(KnowledgePointEntity::getId).collect(Collectors.toSet());
        List<KnowledgeRelationEntity> manualRelations = loadRelations(userId).stream()
                .filter(relation -> nodeIds.contains(relation.getSourceId()) && nodeIds.contains(relation.getTargetId()))
                .toList();
        Set<String> manualPairs = manualRelations.stream()
                .map(relation -> undirectedKey(relation.getSourceId(), relation.getTargetId()))
                .collect(Collectors.toSet());

        List<Map<String, Object>> links = new ArrayList<>();
        for (KnowledgeRelationEntity relation : manualRelations) {
            Map<String, Object> link = new LinkedHashMap<>();
            link.put("source", relation.getSourceId());
            link.put("target", relation.getTargetId());
            link.put("relationType", relation.getRelationType());
            link.put("relationLabel", relation.getRelationLabel());
            links.add(link);
        }

        Set<String> autoPairs = new HashSet<>();
        for (KnowledgePointEntity source : points) {
            for (KnowledgePointEntity target : points) {
                if (source.getId().equals(target.getId()) || target.getTitle().isBlank()) continue;
                if (!source.getContent().contains(target.getTitle())) continue;
                String pair = undirectedKey(source.getId(), target.getId());
                if (manualPairs.contains(pair) || !autoPairs.add(pair)) continue;
                links.add(link(source.getId(), target.getId(), null));
            }
        }
        return new GraphResponse(nodes, links);
    }

    public GraphResponse knowledgeUniverse(String userId) {
        List<KnowledgePointEntity> points = loadPoints(userId);
        if (points.isEmpty()) return GraphResponse.empty();
        Map<String, List<String>> tagsByPoint = loadTags(points);

        List<Map<String, Object>> nodes = points.stream().map(point -> {
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", point.getId());
            node.put("title", point.getTitle());
            node.put("content", point.getContent());
            node.put("category", point.getCategory());
            node.put("tags", tagsByPoint.getOrDefault(point.getId(), List.of()));
            node.put("createdAt", point.getCreatedAt());
            return node;
        }).toList();

        List<Map<String, Object>> links = calculateUniverseAutoLinks(points, tagsByPoint);
        for (KnowledgeRelationEntity relation : loadRelations(userId)) {
            Map<String, Object> link = link(relation.getSourceId(), relation.getTargetId(), "manual");
            link.put("relationLabel", relation.getRelationLabel());
            link.put("_id", relation.getId());
            links.add(link);
        }
        return new GraphResponse(nodes, links);
    }

    private List<Map<String, Object>> calculateUniverseAutoLinks(
            List<KnowledgePointEntity> points,
            Map<String, List<String>> tagsByPoint
    ) {
        List<Map<String, Object>> links = new ArrayList<>();
        Set<String> pairs = new LinkedHashSet<>();
        Map<String, List<KnowledgePointEntity>> categories = points.stream()
                .collect(Collectors.groupingBy(
                        point -> point.getCategory() == null || point.getCategory().isBlank() ? "general" : point.getCategory(),
                        LinkedHashMap::new,
                        Collectors.toList()
                ));
        for (List<KnowledgePointEntity> group : categories.values()) {
            for (int index = 0; index + 1 < group.size(); index++) {
                addAutoLink(links, pairs, group.get(index).getId(), group.get(index + 1).getId());
            }
        }
        for (int first = 0; first < points.size(); first++) {
            for (int second = first + 1; second < points.size(); second++) {
                String firstId = points.get(first).getId();
                String secondId = points.get(second).getId();
                Set<String> firstTags = new HashSet<>(tagsByPoint.getOrDefault(firstId, List.of()));
                boolean shared = tagsByPoint.getOrDefault(secondId, List.of()).stream().anyMatch(firstTags::contains);
                if (shared) addAutoLink(links, pairs, firstId, secondId);
            }
        }
        return links;
    }

    private void addAutoLink(List<Map<String, Object>> links, Set<String> pairs, String source, String target) {
        if (pairs.add(undirectedKey(source, target))) links.add(link(source, target, "auto"));
    }

    private List<KnowledgePointEntity> loadPoints(String userId) {
        return pointMapper.selectList(new LambdaQueryWrapper<KnowledgePointEntity>()
                .eq(KnowledgePointEntity::getAuthorId, userId)
                .orderByAsc(KnowledgePointEntity::getCreatedAt));
    }

    private List<KnowledgeRelationEntity> loadRelations(String userId) {
        return relationMapper.selectList(new LambdaQueryWrapper<KnowledgeRelationEntity>()
                .eq(KnowledgeRelationEntity::getAuthorId, userId)
                .orderByAsc(KnowledgeRelationEntity::getCreatedAt));
    }

    private Map<String, List<String>> loadTags(List<KnowledgePointEntity> points) {
        List<String> ids = points.stream().map(KnowledgePointEntity::getId).toList();
        if (ids.isEmpty()) return Map.of();
        return tagMapper.selectList(new LambdaQueryWrapper<KnowledgePointTagEntity>()
                        .in(KnowledgePointTagEntity::getKnowledgePointId, ids)
                        .orderByAsc(KnowledgePointTagEntity::getId))
                .stream().collect(Collectors.groupingBy(
                        KnowledgePointTagEntity::getKnowledgePointId,
                        Collectors.mapping(KnowledgePointTagEntity::getTag, Collectors.toList())
                ));
    }

    private Map<String, Object> link(String source, String target, String type) {
        Map<String, Object> link = new LinkedHashMap<>();
        link.put("source", source);
        link.put("target", target);
        if (type != null) link.put("type", type);
        return link;
    }

    private String undirectedKey(String first, String second) {
        return first.compareTo(second) <= 0 ? first + "-" + second : second + "-" + first;
    }

    private String abbreviate(String value, int maxLength) {
        return value.length() <= maxLength ? value : value.substring(0, maxLength);
    }
}
