-- Migration: 003_create_review_schedules_table
-- Description: Create review_schedules table for Ebbinghaus forgetting curve implementation
-- Requirements: 4.3, 5.1, 5.2, 5.3

CREATE TABLE IF NOT EXISTS review_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  word_id UUID NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  interval_days INTEGER NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP,
  
  -- Constraints
  CONSTRAINT interval_positive CHECK (interval_days > 0)
);

-- Indexes
-- Composite index for querying due reviews (most common query)
CREATE INDEX idx_review_schedules_user_due ON review_schedules(user_id, due_date) 
  WHERE completed = FALSE;

-- Index for word-based queries
CREATE INDEX idx_review_schedules_word ON review_schedules(word_id);

-- Index for completed reviews
CREATE INDEX idx_review_schedules_completed ON review_schedules(completed, completed_at);

-- Comments
COMMENT ON TABLE review_schedules IS 'Stores review schedules based on Ebbinghaus forgetting curve (1, 3, 7, 15, 30 days)';
COMMENT ON COLUMN review_schedules.id IS 'Unique review schedule identifier (UUID)';
COMMENT ON COLUMN review_schedules.word_id IS 'Foreign key to words table';
COMMENT ON COLUMN review_schedules.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN review_schedules.due_date IS 'Date when review is due';
COMMENT ON COLUMN review_schedules.interval_days IS 'Current interval in days (1, 3, 7, 15, 30, 60, 90)';
COMMENT ON COLUMN review_schedules.completed IS 'Whether this review has been completed';
COMMENT ON COLUMN review_schedules.completed_at IS 'Timestamp when review was completed';
