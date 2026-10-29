ALTER TABLE users ADD COLUMN guest BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN guest_expires_at DATETIME(3) NULL;
CREATE INDEX idx_users_guest_expiry ON users (guest, guest_expires_at);
CREATE TABLE guest_usage (
    bucket_key VARCHAR(180) NOT NULL PRIMARY KEY,
    used_count INT NOT NULL DEFAULT 0,
    expires_at DATETIME(3) NOT NULL,
    KEY idx_guest_usage_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
