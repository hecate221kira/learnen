-- Migration: 001_create_users_table
-- Description: Create users table for authentication and user management
-- Requirements: 1.1, 1.5, 15.3

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT username_length CHECK (LENGTH(username) >= 3),
  CONSTRAINT username_format CHECK (username ~ '^[a-zA-Z0-9_]+$')
);

-- Indexes
CREATE INDEX idx_users_username ON users(username);

-- Comments
COMMENT ON TABLE users IS 'Stores user authentication and profile information';
COMMENT ON COLUMN users.id IS 'Unique user identifier (UUID)';
COMMENT ON COLUMN users.username IS 'Unique username (3-20 characters, alphanumeric and underscore)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt hashed password (60 characters)';
COMMENT ON COLUMN users.email IS 'Optional email address';
COMMENT ON COLUMN users.created_at IS 'Account creation timestamp';
COMMENT ON COLUMN users.updated_at IS 'Last update timestamp';
