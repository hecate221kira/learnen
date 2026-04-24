-- Migration: 004_create_review_attempts_table
-- Description: Create review_attempts table for tracking review performance
-- Requirements: 9.1, 9.2, 9.5

CREATE TABLE IF NOT EXISTS review_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES review_schedules(id) ON DELETE CASCADE,
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  correct BOOLEAN NOT NULL,
  response_time_ms INTEGER,
  
  -- Constraints
  CONSTRAINT response_time_positive CHECK (response_time_ms IS NULL OR response_time_ms > 0)
);

-- Indexes
-- Index for user-based queries (learning statistics)
CREATE INDEX idx_review_attempts_user ON review_attempts(user_id);

-- Index for word-based queries (word performance history)
CREATE INDEX idx_review_attempts_word ON review_attempts(word_id);

-- Index for time-based queries (recent activity)
CREATE INDEX idx_review_attempts_attempted_at ON review_attempts(attempted_at);

-- Composite index for user performance over time
CREATE INDEX idx_review_attempts_user_time ON review_attempts(user_id, attempted_at);

-- Index for schedule-based queries
CREATE INDEX idx_review_attempts_schedule ON review_attempts(schedule_id);

-- Comments
COMMENT ON TABLE review_attempts IS 'Stores all review attempts for tracking learning progress';
COMMENT ON COLUMN review_attempts.id IS 'Unique review attempt identifier (UUID)';
COMMENT ON COLUMN review_attempts.schedule_id IS 'Foreign key to review_schedules table';
COMMENT ON COLUMN review_attempts.word_id IS 'Foreign key to words table';
COMMENT ON COLUMN review_attempts.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN review_attempts.attempted_at IS 'Timestamp when review was attempted';
COMMENT ON COLUMN review_attempts.correct IS 'Whether the answer was correct';
COMMENT ON COLUMN review_attempts.response_time_ms IS 'Response time in milliseconds (optional)';
