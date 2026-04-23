# RAG QA System - Requirements Document

## Introduction

This document outlines the requirements for implementing a complete RAG (Retrieval-Augmented Generation) Question Answering system in the Feynman Platform. The system will enable users to interact with their private knowledge base through an intelligent chat interface, leveraging vector similarity search, LangChain Expression Language (LCEL), and Model Context Protocol (MCP) for optimized prompt engineering.

## Requirements

### 1. Backend Vector Retrieval Service

**User Story**: As a system, I want to retrieve semantically similar document chunks from the vector database, so that relevant context can be provided to the LLM for accurate question answering.

**Acceptance Criteria**:
1.1. WHEN a user query is received, the system SHALL convert the query into an embedding vector using the same embedding model used for document indexing.

1.2. WHEN the query vector is generated, the system SHALL search the HNSWLib vector store and retrieve the top 4 most semantically similar document chunks.

1.3. IF the vector store does not exist or cannot be loaded, the system SHALL return an empty array without crashing.

1.4. WHEN retrieval is complete, the system SHALL log the number of relevant documents found for monitoring purposes.

1.5. WHEN documents are retrieved, each SHALL include the original page content and metadata for further processing.

---

### 2. Backend RAG Chain Implementation

**User Story**: As a backend service, I want to construct a complete RAG chain that orchestrates retrieval, prompt construction, and LLM invocation, so that user questions can be answered based on the knowledge base.

**Acceptance Criteria**:
2.1. WHEN building the RAG chain, the system SHALL use LangChain Expression Language (LCEL) with RunnableSequence to connect components in a declarative pipeline.

2.2. WHEN a question is received, the system SHALL execute the following steps in sequence:
   - Retrieve relevant document chunks using the vector retriever
   - Format the retrieved documents into a readable context string
   - Inject both context and question into a structured prompt template
   - Send the prompt to the Baidu Qianfan LLM (ERNIE-Bot-turbo)
   - Parse the LLM response into a plain string

2.3. WHEN constructing the prompt, the system SHALL follow the Model Context Protocol (MCP) structure using XML-like tags (<role>, <instruction>, <context>, <question>, <answer>) to clearly delineate information sections.

2.4. WHEN the LLM is invoked, the system SHALL use the BaiduQianfanChat model with proper API credentials from environment variables.

2.5. IF an error occurs during chain execution, the system SHALL catch the error, log it, and return a 500 status with an appropriate error message.

---

### 3. Backend API Endpoint for RAG QA

**User Story**: As a frontend client, I want to call a dedicated API endpoint to submit questions and receive AI-generated answers, so that the chat interface can display responses to users.

**Acceptance Criteria**:
3.1. WHEN a POST request is made to `/api/ai/rag-qa`, the system SHALL accept a JSON body containing a `question` field.

3.2. IF the `question` field is missing or empty, the system SHALL return a 400 status with an error message "Question is required."

3.3. WHEN a valid question is received, the system SHALL invoke the RAG chain and return a JSON response containing an `answer` field with the LLM's response.

3.4. WHEN the API is called, the system SHALL require authentication using the existing `auth` middleware.

3.5. WHEN returning the answer, the system SHALL also include the retrieved `sources` (document chunks) in the response for citation display purposes.

---

### 4. Frontend Chat Interface (AgentPage)

**User Story**: As a user, I want a dedicated chat interface where I can ask questions to the AI assistant and see responses in real-time, so that I can interact naturally with my knowledge base.

**Acceptance Criteria**:
4.1. WHEN the user navigates to `/agent`, the system SHALL display a chat interface with a message history area and an input form.

4.2. WHEN the page loads, the system SHALL display an initial greeting message from the bot: "你好！我是你的专属知识库AI助手。有什么可以帮你的吗？"

4.3. WHEN the user types a question and clicks "发送" (or presses Enter), the system SHALL:
   - Add the user's message to the chat history with a "user" sender tag
   - Clear the input field
   - Set a loading state to prevent duplicate submissions

4.4. WHEN the loading state is active, the system SHALL display a typing indicator animation (three bouncing dots) in the chat window.

4.5. WHEN the API response is received, the system SHALL add the bot's answer to the chat history with a "bot" sender tag and clear the loading state.

4.6. IF the API call fails, the system SHALL display an error message from the bot: "抱歉，我遇到了一些问题，请稍后再试。"

4.7. WHEN new messages are added, the system SHALL automatically scroll to the bottom of the chat window to show the latest message.

4.8. WHEN messages are displayed, user messages SHALL be right-aligned with blue background, and bot messages SHALL be left-aligned with gray background.

---

### 5. Display Citation Sources

**User Story**: As a user, I want to see which document chunks the AI used to generate its answer, so that I can verify the accuracy and trace back to the original knowledge sources.

**Acceptance Criteria**:
5.1. WHEN the backend RAG chain executes, it SHALL return not only the answer but also the array of retrieved document chunks in the API response.

5.2. WHEN the frontend receives a bot response, it SHALL check if `sources` are included in the response data.

5.3. IF sources are present, the system SHALL display them below the AI's answer in a collapsible or expandable section.

5.4. WHEN displaying each source, the system SHALL show:
   - A sequential number (e.g., "文档 1", "文档 2")
   - The page content of the document chunk
   - Optionally, metadata such as the original document title or creation date

5.5. WHEN no sources are available (e.g., vector store is empty), the system SHALL NOT display the sources section.

---

### 6. Streaming Response (Typewriter Effect)

**User Story**: As a user, I want to see the AI's response appear gradually character by character (like ChatGPT), so that the interface feels more responsive and engaging.

**Acceptance Criteria**:
6.1. WHEN the backend RAG API is invoked, it SHALL support streaming mode by using the LLM's streaming API instead of waiting for the complete response.

6.2. WHEN streaming is enabled, the backend SHALL return a stream response using Server-Sent Events (SSE) or chunked transfer encoding.

6.3. WHEN the frontend sends a question, it SHALL use the Fetch API (or EventSource if SSE is used) to receive incremental response chunks.

6.4. WHEN each chunk is received, the frontend SHALL append it to the current bot message in real-time, creating a typewriter effect.

6.5. WHEN the stream ends, the frontend SHALL finalize the message and clear the loading state.

6.6. IF an error occurs during streaming, the system SHALL gracefully handle it and display an error message without leaving partial text on screen.

---

### 7. Frontend Routing and Navigation

**User Story**: As a user, I want easy access to the AI assistant page from the main navigation menu, so that I can quickly start asking questions.

**Acceptance Criteria**:
7.1. WHEN the application loads, the React Router SHALL include a route definition for `/agent` that renders the `AgentPage` component.

7.2. WHEN the user views the navigation bar (in `Layout.jsx` or main menu), there SHALL be a visible link labeled "AI助手" or "AI Agent".

7.3. WHEN the user clicks the "AI助手" link, the system SHALL navigate to `/agent` without a full page reload.

7.4. WHEN the `/agent` page is active, the navigation link SHALL indicate the current page (e.g., with highlighting or active state styling).

---

### 8. Chat Interface Styling

**User Story**: As a user, I want a visually appealing and user-friendly chat interface that clearly distinguishes between my messages and the bot's responses, so that conversations are easy to follow.

**Acceptance Criteria**:
8.1. WHEN the chat interface is rendered, it SHALL occupy approximately 80vh of the viewport height and be centered horizontally with a maximum width of 800px.

8.2. WHEN messages are displayed, user messages SHALL have:
   - Right alignment (justify-content: flex-end)
   - Blue background (#007bff)
   - White text color
   - Rounded corners (border-radius: 20px)

8.3. WHEN messages are displayed, bot messages SHALL have:
   - Left alignment (justify-content: flex-start)
   - Gray background (#e9e9eb)
   - Black text color
   - Rounded corners (border-radius: 20px)

8.4. WHEN the typing indicator is shown, it SHALL display three animated dots that bob up and down in sequence to indicate the bot is "thinking."

8.5. WHEN the input form is displayed, it SHALL include:
   - A flexible-width input field with rounded borders
   - A "发送" button with blue background
   - The button SHALL be disabled during loading state and show "思考中..." as the label

8.6. WHEN the chat window overflows, it SHALL provide vertical scrolling with the messages area having a light background color (#f9f9f9).

---

## Edge Cases and Error Handling

### 9. Empty Knowledge Base
**Scenario**: User asks a question when no documents have been indexed.

**Acceptance Criteria**:
9.1. WHEN the vector store is empty or uninitialized, the retrieval SHALL return zero documents.

9.2. WHEN no documents are retrieved, the RAG chain SHALL still execute but with empty context.

9.3. WHEN the LLM receives empty context, it SHALL respond with "我不知道" or similar, following the prompt instruction to not fabricate answers.

---

### 10. Knowledge Base Does Not Contain Relevant Information
**Scenario**: User asks a question outside the scope of the indexed knowledge.

**Acceptance Criteria**:
10.1. WHEN retrieved documents have low semantic similarity to the question, the LLM SHALL recognize the lack of relevant context.

10.2. WHEN the LLM generates a response, it SHALL explicitly state uncertainty (e.g., "根据现有资料，我无法找到相关信息") instead of hallucinating facts.

---

### 11. Network or API Failures
**Scenario**: Baidu Qianfan API is unreachable or returns an error.

**Acceptance Criteria**:
11.1. WHEN the LLM API call fails, the backend SHALL catch the error and log it to the console.

11.2. WHEN an API failure occurs, the backend SHALL return a 500 status with a descriptive error message.

11.3. WHEN the frontend receives a 500 error, it SHALL display a user-friendly message in the chat: "抱歉，我遇到了一些问题，请稍后再试。"

---

## Success Criteria

This feature will be considered successfully implemented when:

- ✅ Users can navigate to the AI Agent page and see a chat interface
- ✅ Users can type questions and receive AI-generated answers based on their knowledge base
- ✅ Answers are accompanied by citation sources showing which document chunks were used
- ✅ Responses appear with a smooth typewriter effect (streaming)
- ✅ The system gracefully handles empty knowledge bases and out-of-scope questions without hallucinating
- ✅ The interface is visually polished with clear distinction between user and bot messages
- ✅ The system logs appropriate debugging information for monitoring and troubleshooting

---

## Non-Functional Requirements

### Performance
- The vector similarity search SHALL complete within 500ms for databases up to 10,000 document chunks
- The end-to-end response time (from question submission to first streaming chunk) SHALL be under 2 seconds

### Security
- The RAG API endpoint SHALL require authentication to prevent unauthorized access
- User questions and answers SHALL NOT be logged in plain text if they contain sensitive information

### Maintainability
- The RAG chain SHALL be constructed using LCEL for readability and easy modification
- The prompt template SHALL be externalized or easily editable for future tuning
- The codebase SHALL follow existing project conventions (e.g., services, controllers, routes separation)

---

**End of Requirements Document**
