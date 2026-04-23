# RAG QA System - Technical Design Document

## Overview

This document provides the technical design for implementing a complete RAG (Retrieval-Augmented Generation) Question Answering system in the Feynman Platform. The system enables users to interact with their private knowledge base through an intelligent chat interface.

### Key Technologies
- **Backend**: Node.js, Express, LangChain.js
- **Vector Database**: HNSWLib (local file-based)
- **LLM**: Baidu Qianfan (ERNIE-Bot-turbo)
- **Embedding**: Baidu Qianfan Embeddings (IAM authentication)
- **Frontend**: React (Vite), React Router
- **Communication**: REST API + Server-Sent Events (SSE) for streaming

---

## Architecture

### High-Level Data Flow

```
User Input (AgentPage)
    ↓
POST /api/ai/rag-qa or /api/ai/rag-qa-stream
    ↓
baiduAiController.answerWithRAG()
    ↓
┌─────────────────────────────────────┐
│         RAG Chain (LCEL)            │
│  ┌────────────────────────────┐     │
│  │ 1. Vector Retriever        │     │
│  │    ↓                       │     │
│  │ 2. Format Documents        │     │
│  │    ↓                       │     │
│  │ 3. MCP Prompt Template     │     │
│  │    ↓                       │     │
│  │ 4. Baidu Qianfan LLM      │     │
│  │    ↓                       │     │
│  │ 5. String Output Parser    │     │
│  └────────────────────────────┘     │
└─────────────────────────────────────┘
    ↓
Response with answer + sources
    ↓
AgentPage renders message + citations
```

### Component Interaction

1. **User Question Input**: User types question in AgentPage
2. **API Request**: Frontend sends POST to backend endpoint
3. **Vector Retrieval**: Query embedded and top-k documents retrieved from HNSWLib
4. **RAG Chain Execution**: LCEL pipeline processes retrieval → prompt → LLM
5. **Response Delivery**: Answer + sources returned to frontend
6. **UI Rendering**: Message displayed with collapsible source citations

---

## Backend Components

### 1. Vector Store Service

**File**: `services/vectorStoreService.js`

**New Export**: `queryVectorStore`

```javascript
/**
 * Retrieve semantically similar documents from vector database
 * @param {string} query - User's question
 * @param {number} k - Number of results to return (default: 4)
 * @returns {Promise<Document[]>} - Array of relevant document chunks
 */
exports.queryVectorStore = async (query, k = 4) => {
  try {
    // 1. Load existing vector store
    const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    
    // 2. Create retriever with k results
    const retriever = vectorStore.asRetriever(k);
    
    // 3. Invoke retriever with query
    const relevantDocs = await retriever.invoke(query);
    
    console.log(`为问题 "${query}" 检索到 ${relevantDocs.length} 个相关文档。`);
    return relevantDocs;
    
  } catch (error) {
    console.error('从向量库检索失败:', error);
    // If vector store doesn't exist, return empty array
    if (error.message.includes('No such file or directory')) {
      return [];
    }
    throw error;
  }
};
```

**Key Points**:
- Reuses existing `embeddings` (BaiduQianfanEmbeddings with IAM auth)
- Returns empty array if vector store doesn't exist (graceful degradation)
- Logs retrieval count for monitoring

---

### 2. AI Controller

**File**: `controllers/baiduAiController.js`

**New Exports**: `answerWithRAG`, `answerWithRAGStream`

#### A. Non-Streaming Implementation

```javascript
const { queryVectorStore } = require('../services/vectorStoreService');
const { PromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { BaiduQianfanChat } = require("@langchain/baidu-qianfan");
const { RunnableSequence } = require("@langchain/core/runnables");
const { HNSWLib } = require("@langchain/community/vectorstores/hnswlib");
const path = require('path');

const VECTOR_STORE_PATH = path.join(__dirname, '../vector_store');

// Initialize embeddings (reuse from vectorStoreService)
const { BaiduQianfanEmbeddings } = require("@langchain/baidu-qianfan");
const embeddings = new BaiduQianfanEmbeddings({
  qianfanAccessKey: process.env.QIANFAN_IAM_ACCESS_KEY,
  qianfanSecretKey: process.env.QIANFAN_IAM_SECRET_KEY,
});

exports.answerWithRAG = async (req, res) => {
  const { question } = req.body;
  
  // 1. Validate input
  if (!question) {
    return res.status(400).json({ msg: 'Question is required.' });
  }
  
  try {
    // 2. Initialize LLM
    const chatModel = new BaiduQianfanChat({
      model: "ERNIE-Bot-turbo",
      qianfanAccessKey: process.env.QIANFAN_ACCESS_KEY,
      qianfanSecretKey: process.env.QIANFAN_SECRET_KEY,
    });
    
    // 3. Define MCP-structured prompt template
    const promptTemplate = PromptTemplate.fromTemplate(
      `<role>你是一个知识库问答机器人。</role>\n` +
      `<instruction>请根据下面提供的<context>信息来回答用户的<question>。如果上下文中没有相关信息，就明确说你不知道，不要编造答案。请让回答简洁明了。</instruction>\n\n` +
      `<context>\n{context}\n</context>\n\n` +
      `<question>\n{question}\n</question>\n\n` +
      `<answer>你的回答是：</answer>`
    );
    
    // 4. Load vector store and create retriever
    const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    const retriever = vectorStore.asRetriever(4);
    
    // 5. Define document formatter
    const formatDocs = (docs) => {
      return docs.map((doc, i) => `--- 文档 ${i+1} ---\n${doc.pageContent}`).join("\n\n");
    };
    
    // 6. Build RAG Chain using LCEL
    const ragChain = RunnableSequence.from([
      // Step 1: Parallel execution - retrieve context and pass question
      {
        context: retriever.pipe(formatDocs),
        question: (input) => input.question,
      },
      // Step 2: Fill prompt template
      promptTemplate,
      // Step 3: Send to LLM
      chatModel,
      // Step 4: Parse output
      new StringOutputParser(),
    ]);
    
    // 7. Execute chain
    const answer = await ragChain.invoke({ question });
    
    // 8. Get source documents for citations
    const sources = await retriever.invoke(question);
    
    // 9. Return result
    res.json({ 
      answer,
      sources: sources.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }))
    });
    
  } catch (error) {
    console.error('RAG Chain execution error:', error);
    res.status(500).json({ msg: 'Error answering question with RAG.' });
  }
};
```

**MCP Prompt Structure**:
- `<role>`: Defines the AI's persona
- `<instruction>`: Clear task instructions with anti-hallucination directive
- `<context>`: Retrieved document chunks
- `<question>`: User's query
- `<answer>`: Output indicator

**Error Handling**:
- 400: Missing question parameter
- 500: Vector store or LLM API failure
- All errors logged with context

#### B. Streaming Implementation

```javascript
exports.answerWithRAGStream = async (req, res) => {
  const { question } = req.body;
  
  if (!question) {
    return res.status(400).json({ msg: 'Question is required.' });
  }
  
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  try {
    // Initialize streaming chat model
    const chatModel = new BaiduQianfanChat({
      model: "ERNIE-Bot-turbo",
      qianfanAccessKey: process.env.QIANFAN_ACCESS_KEY,
      qianfanSecretKey: process.env.QIANFAN_SECRET_KEY,
      streaming: true,  // Enable streaming
    });
    
    // Define prompt template (same as non-streaming)
    const promptTemplate = PromptTemplate.fromTemplate(
      `<role>你是一个知识库问答机器人。</role>\n` +
      `<instruction>请根据下面提供的<context>信息来回答用户的<question>。如果上下文中没有相关信息，就明确说你不知道，不要编造答案。请让回答简洁明了。</instruction>\n\n` +
      `<context>\n{context}\n</context>\n\n` +
      `<question>\n{question}\n</question>\n\n` +
      `<answer>你的回答是：</answer>`
    );
    
    // Load vector store and create retriever
    const vectorStore = await HNSWLib.load(VECTOR_STORE_PATH, embeddings);
    const retriever = vectorStore.asRetriever(4);
    
    const formatDocs = (docs) => {
      return docs.map((doc, i) => `--- 文档 ${i+1} ---\n${doc.pageContent}`).join("\n\n");
    };
    
    // Build RAG chain
    const ragChain = RunnableSequence.from([
      {
        context: retriever.pipe(formatDocs),
        question: (input) => input.question,
      },
      promptTemplate,
      chatModel,
      new StringOutputParser(),
    ]);
    
    // Execute chain with streaming
    const stream = await ragChain.stream({ question });
    
    // Send chunks as SSE
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }
    
    // Send sources at the end
    const sources = await retriever.invoke(question);
    res.write(`data: ${JSON.stringify({ 
      type: 'sources', 
      sources: sources.map(doc => ({
        content: doc.pageContent,
        metadata: doc.metadata
      }))
    })}\n\n`);
    
    // End stream
    res.write('data: [DONE]\n\n');
    res.end();
    
  } catch (error) {
    console.error('Streaming error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
};
```

**SSE Event Format**:
```
data: {"chunk":"React"}
data: {"chunk":" Hooks"}
data: {"chunk":" 是"}
...
data: {"type":"sources","sources":[...]}
data: [DONE]
```

---

### 3. Routes

**File**: `routes/ai.js`

**Changes**:
```javascript
const { answerWithRAG, answerWithRAGStream } = require('../controllers/baiduAiController');

// Non-streaming RAG QA
router.post('/rag-qa', auth, answerWithRAG);

// Streaming RAG QA
router.post('/rag-qa-stream', auth, answerWithRAGStream);
```

---

## Frontend Components

### 1. AgentPage Component

**File**: `src/pages/AgentPage.jsx`

**Complete Implementation** (Streaming version from course document)

---

### 2. Styling

**File**: `src/pages/AgentPage.css`

**Complete CSS** (from course document)

---

### 3. App Routing

**File**: `src/App.jsx`

```javascript
import AgentPage from './pages/AgentPage';

// Inside <ProtectedRoute>
<Route path="/agent" element={<AgentPage />} />
```

---

### 4. Navigation

**File**: `src/components/Layout.jsx`

```jsx
<Link to="/agent">AI助手</Link>
```

---

## Implementation Phases

### Phase 1: Backend Core
- Implement `queryVectorStore` in vectorStoreService
- Implement `answerWithRAG` in baiduAiController
- Add `/rag-qa` route
- Test with Postman

### Phase 2: Frontend Chat (Non-streaming)
- Create AgentPage.jsx
- Create AgentPage.css
- Add routing
- Test end-to-end

### Phase 3: Source Citations
- Backend returns sources
- Frontend displays collapsible citations

### Phase 4: Streaming
- Implement `answerWithRAGStream`
- Frontend SSE handler
- Test typewriter effect

---

**End of Design Document**
