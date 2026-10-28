package com.feynman.platform.rag;

import java.util.List;
import java.util.stream.IntStream;
import org.springframework.stereotype.Service;

@Service
public class RagQaService {
    private static final double MIN_SIMILARITY = 0.30;

    private final RagIndexService indexService;
    private final RagEmbeddingIndexService embeddingIndexService;
    private final RagDeepSeekClient deepSeekClient;

    public RagQaService(
            RagIndexService indexService,
            RagEmbeddingIndexService embeddingIndexService,
            RagDeepSeekClient deepSeekClient
    ) {
        this.indexService = indexService;
        this.embeddingIndexService = embeddingIndexService;
        this.deepSeekClient = deepSeekClient;
    }

    public RagQaResponse answer(String userId, RagSearchRequest request) {
        RagPreparedQuestion prepared = prepare(userId, request);
        String answer = prepared.needsAi() ? deepSeekClient.answer(prepared.prompt()) : prepared.directAnswer();
        return new RagQaResponse(answer, prepared.sources());
    }

    public RagPreparedQuestion prepare(String userId, RagSearchRequest request) {
        List<RagSearchResult> sources = retrieve(userId, request);
        if (sources.isEmpty()) {
            return new RagPreparedQuestion(
                    request.question(), null, List.of(),
                    "你的知识库中暂时没有与这个问题足够相关的内容，我无法根据现有资料回答。"
            );
        }
        String context = IntStream.range(0, sources.size())
                .mapToObj(index -> "--- 资料 " + (index + 1) + "（" +
                        sources.get(index).metadata().get("title") + "）---\n" + sources.get(index).content())
                .reduce((left, right) -> left + "\n\n" + right).orElse("");
        String prompt = """
                你是费曼学习平台的私人知识库助手。
                只能依据下面的“知识库资料”回答问题，不得使用资料之外的事实补充答案。
                如果资料不足以回答，请明确说“现有知识库资料不足”，并指出缺少什么信息。
                回答使用简洁、自然的中文。不要声称自己查阅了未提供的资料。

                【知识库资料】
                %s

                【用户问题】
                %s

                【回答】
                """.formatted(context, request.question().trim());
        return new RagPreparedQuestion(request.question(), prompt, sources, null);
    }

    private List<RagSearchResult> retrieve(String userId, RagSearchRequest request) {
        RagSearchResponse initial = embeddingIndexService.search(userId, request);
        if (initial.sources().isEmpty()) {
            RagRebuildResponse rebuilt = indexService.rebuild(userId);
            if (rebuilt.chunks() > 0) embeddingIndexService.generatePending(userId);
            initial = embeddingIndexService.search(userId, request);
        }
        return initial.sources().stream()
                .filter(source -> source.score() >= MIN_SIMILARITY)
                .toList();
    }
}
