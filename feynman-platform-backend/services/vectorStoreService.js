const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");
const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const path = require('path');
const fs = require('fs');

const VECTOR_STORE_PATH = path.join(__dirname, '../vector_store');

const HF_MIRROR = process.env.HF_ENDPOINT || 'https://hf-mirror.com';

/**
 * 修复 HuggingFace 镜像问题的自定义 Embeddings 类
 *
 * 背景：LangChain 的 HuggingFaceTransformersEmbeddings 内部使用
 *   import('@huggingface/transformers') 动态加载模块，
 *   而 Node.js 中 require() 和 import() 会创建两个独立的模块实例。
 *   因此通过 require() 设置的 env.remoteHost 对 import() 实例无效，
 *   导致在国内网络下所有模型下载请求都发往 huggingface.co 而 fetch failed。
 *
 * 方案：重写 runEmbedding()，在 import() 后立即设置 env.remoteHost 指向镜像。
 */
class MirroredHFEmbeddings extends HuggingFaceTransformersEmbeddings {
    constructor(fields) {
        super(fields);
        // 清除父类可能已经创建的 pipelinePromise（确保用我们重写的逻辑）
        this.pipelinePromise = null;
    }

    async runEmbedding(texts) {
        if (!this.pipelinePromise) {
            this.pipelinePromise = (async () => {
                const transformers = await import('@huggingface/transformers');
                // 关键：在 import() 返回的 ESM 实例上设置镜像
                transformers.env.remoteHost = HF_MIRROR;
                transformers.env.remotePathTemplate = '{model}/resolve/{revision}/';
                console.log('[RAG] ESM 实例镜像已设置：', transformers.env.remoteHost);
                const pipeline = transformers.pipeline;
                return await pipeline(
                    'feature-extraction',
                    this.model,
                    this.pretrainedOptions || {}
                );
            })();
        }
        const pipe = await this.pipelinePromise;
        return this.caller.call(async () => {
            const output = await pipe(texts, this.pipelineOptions || { pooling: 'mean', normalize: true });
            return output.tolist();
        });
    }
}

// 同时设置 require 实例（兼容直接使用 @huggingface/transformers 的场景）
try {
    const { env: hfEnv } = require('@huggingface/transformers');
    hfEnv.remoteHost = HF_MIRROR;
    hfEnv.remotePathTemplate = '{model}/resolve/{revision}/';
    console.log('[RAG] CJS 实例镜像已设置：', HF_MIRROR);
} catch(e) {
    console.warn('[RAG] 设置 CJS 镜像失败:', e.message);
}

console.log('[RAG] 使用本地 HuggingFace Transformers 进行向量化（无需 API Key）');
console.log('[RAG] 镜像地址：', HF_MIRROR);

const embeddings = new MirroredHFEmbeddings({
    model: "Xenova/multilingual-e5-small",
});

// 使用官方文本分割器
const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
});

// 限流辅助：等待指定毫秒
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 带重试的向量化辅助函数
 * 遇到 QPS/RPM 限流时，指数退避重试
 */
async function fromDocumentsWithRetry(docs, embeddings, maxRetries = 4) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await HNSWLib.fromDocuments(docs, embeddings);
        } catch (e) {
            const isRateLimit = e.message && (
                e.message.toLowerCase().includes('qps') ||
                e.message.toLowerCase().includes('rate') ||
                e.message.toLowerCase().includes('limit') ||
                e.message.includes('336501') ||
                e.message.includes('18')
            );
            if (isRateLimit && attempt < maxRetries) {
                const delay = attempt * 8000; // 8s, 16s, 24s
                console.log(`[RAG] 遇到限流，${delay / 1000}秒后重试 (${attempt}/${maxRetries})...`);
                await sleep(delay);
            } else {
                throw e;
            }
        }
    }
}

/**
 * 导出修复后的 embeddings 实例供其他模块使用
 */
exports.embeddings = embeddings;

/**
 * 导出向量库路径
 */
exports.VECTOR_STORE_PATH = VECTOR_STORE_PATH;

/**
 * 批量重建向量库 - 逐个知识点处理，每个之间间隔 3 秒，遇到限流自动重试
 * @param {Array} knowledgePoints - 知识点数组
 */
exports.rebuildVectorStore = async (knowledgePoints) => {
    const validKps = knowledgePoints.filter(kp => kp.content && kp.content.trim());
    if (validKps.length === 0) {
        console.warn('[RAG] 没有有效知识点，跳过重建。');
        return;
    }

    // 确保目录存在
    if (!fs.existsSync(VECTOR_STORE_PATH)) {
        fs.mkdirSync(VECTOR_STORE_PATH, { recursive: true });
    }

    console.log(`[RAG] 开始逐个重建，共 ${validKps.length} 个知识点，每个间隔 3 秒...`);
    let vectorStore = null;

    for (let i = 0; i < validKps.length; i++) {
        const kp = validKps[i];
        console.log(`[RAG] [${i + 1}/${validKps.length}] 处理: ${kp.title || kp._id}`);
        try {
            const docs = await textSplitter.createDocuments(
                [kp.content],
                [{ knowledgePointId: kp._id.toString(), title: kp.title || '' }]
            );
            if (vectorStore === null) {
                vectorStore = await fromDocumentsWithRetry(docs, embeddings);
            } else {
                await vectorStore.addDocuments(docs);
            }
            // 每个知识点处理完后等待 3 秒，避免 QPS 限流
            if (i < validKps.length - 1) {
                await sleep(3000);
            }
        } catch (e) {
            console.error(`[RAG] 索引失败: ${kp.title}`, e.message);
        }
    }

    if (vectorStore) {
        await vectorStore.save(VECTOR_STORE_PATH);
        console.log(`[RAG] 向量库重建完成！共处理 ${validKps.length} 个知识点。`);
    }
};

/**
 * 将单个知识点的内容添加到向量数据库中
 * @param {object} knowledgePoint - 包含 _id 和 content 的知识点对象
 */
exports.addKnowledgePointToStore = async (knowledgePoint) => {
    try {
        console.log(`[RAG] 正在处理知识点: ${knowledgePoint.title || knowledgePoint._id}...`);

        if (!knowledgePoint.content) {
            console.warn('[RAG] 知识点内容为空，跳过向量化。');
            return;
        }

        // 1. 分割文本
        const docs = await textSplitter.createDocuments(
            [knowledgePoint.content],
            [{ knowledgePointId: knowledgePoint._id.toString() }]
        );
        console.log(`[RAG] 文本已分割为 ${docs.length} 个片段。`);

        // 2. 检查/创建向量库目录
        if (!fs.existsSync(VECTOR_STORE_PATH)) {
            fs.mkdirSync(VECTOR_STORE_PATH, { recursive: true });
        }

        // 3. 加载或新建向量库（单条添加后等待 1 秒限流）
        let vectorStore;
        try {
            vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
            console.log('[RAG] 加载现有向量库成功，正在添加新文档...');
            await vectorStore.addDocuments(docs);
        } catch (e) {
            console.log('[RAG] 未找到现有向量库或加载失败，正在初始化新库...');
            vectorStore = await HNSWLib.fromDocuments(docs, embeddings);
        }

        // 4. 保存向量库到磁盘
        await vectorStore.save(VECTOR_STORE_PATH);
        console.log(`[RAG] 知识点 "${knowledgePoint.title || knowledgePoint._id}" 已成功存入向量库！`);

        // 5. 单条添加限流保护
        await sleep(1000);

    } catch (error) {
        console.error('[RAG Error] 向量化失败:', error);
        if (error.response) {
            console.error('[RAG Error] 详细响应:', error.response.data);
        }
    }
};

/**
 * 从向量数据库中检索与问题相关的文档
 * @param {string} query - 用户的问题
 * @param {number} k - 返回结果数量 (默认: 4)
 * @returns {Promise<Document[]>} - 返回相关文档片段的数组
 */
exports.queryVectorStore = async (query, k = 4) => {
    try {
        console.log(`[RAG] 正在检索问题: "${query}"...`);

        // 1. 加载向量数据库
        const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);

        // 2. 从向量存储创建一个检索器 (Retriever)
        // .asRetriever(k) 表示返回最相关的 k 个结果
        const retriever = vectorStore.asRetriever(k);

        // 3. 使用检索器获取相关文档
        const relevantDocs = await retriever.invoke(query);

        console.log(`[RAG] 为问题 "${query}" 检索到 ${relevantDocs.length} 个相关文档。`);
        return relevantDocs;

    } catch (error) {
        console.error('[RAG] 从向量库检索失败:', error);
        // 如果向量库不存在，可以返回空数组或特定错误
        if (error.message && error.message.includes('No such file or directory')) {
            console.warn('[RAG] 向量库不存在，返回空数组。');
            return [];
        }
        throw error;
    }
};
