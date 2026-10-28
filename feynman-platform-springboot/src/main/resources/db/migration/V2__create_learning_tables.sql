CREATE TABLE knowledge_points (
    id CHAR(24) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content LONGTEXT NOT NULL,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    author_id CHAR(24) NOT NULL,
    difficulty VARCHAR(20) NOT NULL DEFAULT 'beginner',
    is_public BOOLEAN NOT NULL DEFAULT TRUE,
    views INT NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'learning',
    review_list BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_knowledge_points_author_created (author_id, created_at),
    KEY idx_knowledge_points_author_status (author_id, status),
    KEY idx_knowledge_points_author_review (author_id, review_list),
    CONSTRAINT fk_knowledge_points_author FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT chk_knowledge_points_difficulty CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
    CONSTRAINT chk_knowledge_points_status CHECK (status IN ('learning', 'mastered', 'reviewing'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_point_tags (
    id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    knowledge_point_id CHAR(24) NOT NULL,
    tag VARCHAR(100) NOT NULL,
    UNIQUE KEY uk_knowledge_point_tags (knowledge_point_id, tag),
    CONSTRAINT fk_knowledge_point_tags_point FOREIGN KEY (knowledge_point_id)
        REFERENCES knowledge_points (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_point_likes (
    knowledge_point_id CHAR(24) NOT NULL,
    user_id CHAR(24) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (knowledge_point_id, user_id),
    CONSTRAINT fk_knowledge_point_likes_point FOREIGN KEY (knowledge_point_id)
        REFERENCES knowledge_points (id) ON DELETE CASCADE,
    CONSTRAINT fk_knowledge_point_likes_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE weak_points (
    id CHAR(24) NOT NULL PRIMARY KEY,
    knowledge_point_id CHAR(24) NOT NULL,
    author_id CHAR(24) NOT NULL,
    content TEXT NOT NULL,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_weak_points_author_resolved (author_id, resolved),
    CONSTRAINT fk_weak_points_point FOREIGN KEY (knowledge_point_id)
        REFERENCES knowledge_points (id) ON DELETE CASCADE,
    CONSTRAINT fk_weak_points_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE knowledge_relations (
    id CHAR(24) NOT NULL PRIMARY KEY,
    source_id CHAR(24) NOT NULL,
    target_id CHAR(24) NOT NULL,
    author_id CHAR(24) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'manual',
    relation_type VARCHAR(30) NOT NULL DEFAULT 'reference',
    strength DECIMAL(4, 3) NOT NULL DEFAULT 0.500,
    relation_label VARCHAR(50),
    description VARCHAR(200),
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    UNIQUE KEY uk_relations_source_target_author (source_id, target_id, author_id),
    KEY idx_relations_author_source (author_id, source_id),
    KEY idx_relations_author_target (author_id, target_id),
    CONSTRAINT fk_relations_source FOREIGN KEY (source_id) REFERENCES knowledge_points (id) ON DELETE CASCADE,
    CONSTRAINT fk_relations_target FOREIGN KEY (target_id) REFERENCES knowledge_points (id) ON DELETE CASCADE,
    CONSTRAINT fk_relations_author FOREIGN KEY (author_id) REFERENCES users (id),
    CONSTRAINT chk_relations_type CHECK (type IN ('auto', 'manual')),
    CONSTRAINT chk_relations_strength CHECK (strength >= 0 AND strength <= 1),
    CONSTRAINT chk_relations_distinct CHECK (source_id <> target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE feynman_attempts (
    id CHAR(24) NOT NULL PRIMARY KEY,
    knowledge_point_id CHAR(24) NOT NULL,
    author_id CHAR(24) NOT NULL,
    transcribed_text LONGTEXT NOT NULL,
    polished_text LONGTEXT,
    standard_answer LONGTEXT,
    score DECIMAL(5, 2),
    feedback LONGTEXT,
    duration_ms BIGINT,
    duration_seconds BIGINT,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    KEY idx_attempts_author_point_created (author_id, knowledge_point_id, created_at),
    CONSTRAINT fk_attempts_point FOREIGN KEY (knowledge_point_id) REFERENCES knowledge_points (id),
    CONSTRAINT fk_attempts_author FOREIGN KEY (author_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
