-- Migration: 002_create_words_table
-- Description: Create words table for storing learned vocabulary
-- Requirements: 4.2, 10.1

CREATE TABLE IF NOT EXISTS words (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  english_word VARCHAR(50) NOT NULL,
  chinese_translation VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  image_validated_at TIMESTAMP,
  learned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Constraints
  CONSTRAINT word_length CHECK (LENGTH(english_word) > 0 AND LENGTH(english_word) <= 50),
  CONSTRAINT word_format CHECK (english_word ~ '^[a-zA-Z ]+$')
);

-- Indexes
CREATE INDEX idx_words_user_id ON words(user_id);
CREATE INDEX idx_words_learned_at ON words(learned_at);
CREATE INDEX idx_words_user_word ON words(user_id, english_word);

-- Comments
COMMENT ON TABLE words IS 'Stores vocabulary words learned by users';
COMMENT ON COLUMN words.id IS 'Unique word record identifier (UUID)';
COMMENT ON COLUMN words.user_id IS 'Foreign key to users table';
COMMENT ON COLUMN words.english_word IS 'English word (1-50 characters, letters and spaces only)';
COMMENT ON COLUMN words.chinese_translation IS 'Chinese translation from Google Translate API';
COMMENT ON COLUMN words.image_url IS 'URL of associated image';
COMMENT ON COLUMN words.image_validated_at IS 'Last time image URL was validated';
COMMENT ON COLUMN words.learned_at IS 'Timestamp when user learned this word';
