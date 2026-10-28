CREATE TABLE rag_chunks (
    id CHAR(24) NOT NULL PRIMARY KEY,
    knowledge_point_id CHAR(24) NOT NULL,
    author_id CHAR(24) NOT NULL,
    chunk_index INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_hash CHAR(64) NOT NULL,
    embedding MEDIUMBLOB,
    embedding_dimensions INT,
    embedding_model VARCHAR(120),
    embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_rag_chunks_point_index (knowledge_point_id, chunk_index),
    KEY idx_rag_chunks_author_status (author_id, embedding_status),
    KEY idx_rag_chunks_author_point (author_id, knowledge_point_id),
    CONSTRAINT fk_rag_chunks_point FOREIGN KEY (knowledge_point_id)
        REFERENCES knowledge_points (id) ON DELETE CASCADE,
    CONSTRAINT fk_rag_chunks_author FOREIGN KEY (author_id)
        REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT chk_rag_chunks_status CHECK (embedding_status IN ('pending', 'ready', 'failed'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
