-- Migration: 006_add_performance_indexes
-- Description: Add additional indexes for performance optimization
-- Requirements: 13.4
-- Task: 14.1 - API Response Time Optimization

-- Add composite index for frequently accessed word queries
-- This optimizes queries that filter by user_id and order by learned_at
CREATE INDEX IF NOT EXISTS idx_words_user_learned ON words(user_id, learned_at DESC);

-- Add index for image cache lookups by validity and search term
-- This optimizes queries that need to find valid cached images quickly
CREATE INDEX IF NOT EXISTS idx_image_cache_valid_search ON image_cache(is_valid, search_term, validated_at DESC)
  WHERE is_valid = TRUE;

-- Add index for review attempts by user and timestamp
-- This optimizes queries for user statistics and recent activity
CREATE INDEX IF NOT EXISTS idx_review_attempts_user_time ON review_attempts(user_id, attempted_at DESC);

-- Add index for review attempts by word
-- This optimizes queries for word-specific statistics
CREATE INDEX IF NOT EXISTS idx_review_attempts_word_time ON review_attempts(word_id, attempted_at DESC);

-- Add partial index for pending reviews
-- This optimizes the most common query: finding due, incomplete reviews
CREATE INDEX IF NOT EXISTS idx_review_schedules_pending ON review_schedules(user_id, due_date, word_id)
  WHERE completed = FALSE;

-- Comments
COMMENT ON INDEX idx_words_user_learned IS 'Optimizes user word queries ordered by learning date';
COMMENT ON INDEX idx_image_cache_valid_search IS 'Optimizes valid image cache lookups';
COMMENT ON INDEX idx_review_attempts_user_time IS 'Optimizes user activity queries';
COMMENT ON INDEX idx_review_attempts_word_time IS 'Optimizes word statistics queries';
COMMENT ON INDEX idx_review_schedules_pending IS 'Optimizes pending review queries';

