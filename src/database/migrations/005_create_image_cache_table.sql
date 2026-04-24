-- Migration: 005_create_image_cache_table
-- Description: Create image_cache table for caching image URLs
-- Requirements: 12.4, 12.5

CREATE TABLE IF NOT EXISTS image_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  search_term VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  source VARCHAR(50),
  cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_valid BOOLEAN DEFAULT TRUE,
  
  -- Constraints
  UNIQUE(search_term, image_url)
);

-- Indexes
-- Index for search term lookups (most common query)
CREATE INDEX idx_image_cache_search_term ON image_cache(search_term);

-- Index for finding images that need validation (validated_at > 30 days ago)
CREATE INDEX idx_image_cache_validated_at ON image_cache(validated_at) 
  WHERE is_valid = TRUE;

-- Index for valid images
CREATE INDEX idx_image_cache_valid ON image_cache(is_valid, search_term);

-- Comments
COMMENT ON TABLE image_cache IS 'Caches image URLs to reduce external API calls';
COMMENT ON COLUMN image_cache.id IS 'Unique cache entry identifier (UUID)';
COMMENT ON COLUMN image_cache.search_term IS 'Search term used to retrieve image (usually English word)';
COMMENT ON COLUMN image_cache.image_url IS 'Cached image URL';
COMMENT ON COLUMN image_cache.source IS 'Image source (e.g., "unsplash", "pexels")';
COMMENT ON COLUMN image_cache.cached_at IS 'Timestamp when image was first cached';
COMMENT ON COLUMN image_cache.validated_at IS 'Last time URL validity was checked';
COMMENT ON COLUMN image_cache.is_valid IS 'Whether the URL is currently valid';
