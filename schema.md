# Database Schema
## Whop Cross-Community Blogging App

**Version:** 1.0  
**Database:** PostgreSQL 15+  
**Date:** November 2, 2025

---

## Overview

This database schema supports:
- Multi-tenancy across multiple Whop communities
- Cross-community feed aggregation
- Efficient querying of user access permissions
- High-performance feed generation
- Social engagement features (likes, comments)
- Content moderation

---

## Schema Diagram

```
┌──────────┐      ┌─────────────┐      ┌──────┐
│ companies├──────┤user_companies├──────┤users │
└────┬─────┘      └─────────────┘      └──┬───┘
     │                                     │
     │                                     │
     │            ┌───────┐                │
     └────────────┤ posts ├────────────────┘
                  └───┬───┘
                      │
         ┌────────────┼────────────┬────────────┐
         │            │            │            │
    ┌────┴──┐   ┌────┴────┐  ┌────┴─┐    ┌─────┴────┐
    │ likes │   │comments │  │media │    │post_links│
    └───────┘   └─────────┘  └──────┘    └──────────┘
```

---

## Table Definitions

### 1. users

Caches Whop user data for performance and to reduce API calls.

```sql
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,  -- Whop user ID (user_xxx)
    username VARCHAR(100),
    name VARCHAR(255),
    email VARCHAR(255),
    profile_pic_url TEXT,
    profile_pic_url_32 TEXT,
    profile_pic_url_64 TEXT,
    profile_pic_url_128 TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_created (created_at)
);
```

**Field Descriptions:**
- `id`: Whop's unique user identifier
- `username`: User's display username (not guaranteed unique)
- `name`: User's full name
- `email`: User's email address
- `profile_pic_url`: URL to user's profile picture (various sizes cached)
- `created_at`: When this user was first seen in our system
- `updated_at`: Last time user data was refreshed from Whop

**Notes:**
- Data synced from Whop API on first interaction
- Updated periodically or on webhook events
- Should be treated as cache (source of truth is Whop)

---

### 2. companies

Tracks Whop companies (communities) where the app is installed.

```sql
CREATE TABLE companies (
    id VARCHAR(255) PRIMARY KEY,  -- Whop company ID (biz_xxx)
    name VARCHAR(255) NOT NULL,
    experience_id VARCHAR(255) NOT NULL,  -- Experience ID for this app instance
    
    -- App settings for this community
    settings JSONB DEFAULT '{}',
    
    -- Metadata
    installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    uninstalled_at TIMESTAMP NULL,
    
    INDEX idx_experience (experience_id),
    INDEX idx_active (is_active, installed_at),
    UNIQUE KEY unique_experience (experience_id)
);
```

**Field Descriptions:**
- `id`: Whop's company identifier
- `name`: Company/community name
- `experience_id`: Unique ID for this app installation instance
- `settings`: JSONB object containing community-specific configuration

**Settings JSONB Structure:**
```json
{
  "display_name": "Community Blog",
  "primary_color": "#FF5733",
  "logo_url": "https://...",
  "posting_permission": "all_members",  // "all_members" | "admins_only"
  "allow_images": true,
  "allow_links": true,
  "max_images_per_post": 4
}
```

**Notes:**
- Created when app is installed via webhook
- `is_active` set to false when app is uninstalled
- One experience per company installation

---

### 3. user_companies

**CRITICAL TABLE**: Tracks which users have access to which companies.  
This enables cross-community feed functionality.

```sql
CREATE TABLE user_companies (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    company_id VARCHAR(255) NOT NULL,
    membership_id VARCHAR(255),  -- Whop membership ID (mem_xxx)
    
    -- Access control
    has_access BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'member',  -- 'member', 'admin', 'owner'
    
    -- Timestamps
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_verified TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,  -- For time-limited memberships
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Indexes
    UNIQUE KEY unique_user_company (user_id, company_id),
    INDEX idx_user_access (user_id, has_access),
    INDEX idx_user_active_access (user_id, has_access, expires_at) 
        WHERE has_access = TRUE,
    INDEX idx_company (company_id),
    INDEX idx_company_active (company_id, has_access) 
        WHERE has_access = TRUE,
    INDEX idx_membership (membership_id),
    INDEX idx_expires (expires_at) WHERE expires_at IS NOT NULL
);
```

**Field Descriptions:**
- `user_id`: Reference to user
- `company_id`: Reference to company
- `membership_id`: Whop's membership identifier
- `has_access`: Boolean flag for quick access checks
- `role`: User's role in this community (for admin features)
- `last_verified`: Last time access was verified with Whop API
- `expires_at`: When membership expires (for limited memberships)

**How This Table is Updated:**
1. **Webhook: `membership.went_valid`**
   ```sql
   INSERT INTO user_companies (user_id, company_id, membership_id, has_access)
   VALUES (?, ?, ?, TRUE)
   ON CONFLICT (user_id, company_id) 
   DO UPDATE SET has_access = TRUE, last_verified = CURRENT_TIMESTAMP;
   ```

2. **Webhook: `membership.went_invalid`**
   ```sql
   UPDATE user_companies 
   SET has_access = FALSE, last_verified = CURRENT_TIMESTAMP
   WHERE user_id = ? AND company_id = ?;
   ```

**Critical Indexes Explained:**
- `idx_user_access`: Fast lookup of all communities a user can access
- `idx_user_active_access`: Partial index only for active memberships (saves space)
- `idx_company_active`: Fast lookup of all active members in a community

---

### 4. posts

Core content table storing all user posts.

```sql
CREATE TABLE posts (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid(),  -- Public-facing ID
    
    -- Relationships
    user_id VARCHAR(255) NOT NULL,
    company_id VARCHAR(255) NOT NULL,
    experience_id VARCHAR(255) NOT NULL,
    
    -- Content
    content TEXT NOT NULL,  -- Post text content
    content_type VARCHAR(20) DEFAULT 'text',  -- 'text', 'image', 'link'
    
    -- Status flags
    is_pinned BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,  -- Soft delete
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Cached engagement counts (denormalized for performance)
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Critical indexes for feed queries
    INDEX idx_company_created (company_id, created_at DESC, is_deleted),
    INDEX idx_company_active (company_id, created_at DESC) 
        WHERE is_deleted = FALSE,
    INDEX idx_user_created (user_id, created_at DESC),
    INDEX idx_pinned (company_id, is_pinned, created_at DESC) 
        WHERE is_pinned = TRUE AND is_deleted = FALSE,
    INDEX idx_created (created_at DESC) 
        WHERE is_deleted = FALSE,
    
    -- Full-text search index (for future search feature)
    INDEX idx_content_fulltext USING GIN (to_tsvector('english', content)),
    
    -- Constraint for pinned posts limit (enforced in app logic)
    CHECK (content IS NOT NULL AND LENGTH(content) > 0),
    CHECK (LENGTH(content) <= 5000)
);
```

**Field Descriptions:**
- `uuid`: Public-facing unique identifier (used in URLs)
- `content`: Post text (max 5,000 characters)
- `content_type`: Type of post for UI rendering
- `is_pinned`: Whether post is pinned by admin
- `is_deleted`: Soft delete flag (post retained but hidden)
- `likes_count`: Cached count for performance
- `comments_count`: Cached count for performance

**Important Notes:**
- Use `uuid` in public APIs, never expose `id`
- Soft deletes preserve data for moderation/audit
- Engagement counts are denormalized for performance
- Must be recalculated if they drift

**Content Type Values:**
- `text`: Plain text post
- `image`: Post with image attachments
- `link`: Post with link preview

---

### 5. post_media

Images and other media attached to posts.

```sql
CREATE TABLE post_media (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    
    -- Media details
    media_type VARCHAR(20) NOT NULL,  -- 'image', 'video', 'gif'
    url TEXT NOT NULL,  -- S3/R2 URL
    thumbnail_url TEXT,  -- Optimized thumbnail
    
    -- Image metadata
    width INT,
    height INT,
    file_size INT,  -- bytes
    mime_type VARCHAR(100),
    
    -- Display
    display_order INT DEFAULT 0,  -- Order of images in post
    alt_text VARCHAR(500),  -- Accessibility
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_post_media (post_id, display_order)
);
```

**Field Descriptions:**
- `media_type`: Type of media (primarily images for MVP)
- `url`: Full URL to media file
- `thumbnail_url`: Smaller version for feed display
- `display_order`: Order to display multiple images
- `alt_text`: Accessibility description

**Notes:**
- Max 4 images per post (enforced in application logic)
- Images compressed before upload
- Thumbnails auto-generated on upload

---

### 6. post_links

Link previews for URLs in posts.

```sql
CREATE TABLE post_links (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    
    -- Link details
    url TEXT NOT NULL,
    title VARCHAR(500),
    description TEXT,
    image_url TEXT,
    domain VARCHAR(255),
    
    -- Metadata
    fetch_success BOOLEAN DEFAULT TRUE,
    fetch_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_post_links (post_id),
    INDEX idx_url (url(255))  -- Partial index for URL lookups
);
```

**Field Descriptions:**
- `url`: Full URL that was linked
- `title`: Extracted page title
- `description`: Extracted meta description
- `image_url`: Extracted Open Graph image
- `domain`: Extracted domain for display
- `fetch_success`: Whether metadata extraction succeeded

**How It Works:**
1. User includes URL in post
2. Background job fetches metadata via Open Graph/meta tags
3. Preview displayed in post

---

### 7. likes

Tracks user likes on posts.

```sql
CREATE TABLE likes (
    id BIGSERIAL PRIMARY KEY,
    post_id BIGINT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Constraints and indexes
    UNIQUE KEY unique_user_post_like (user_id, post_id),
    INDEX idx_post_likes (post_id, created_at DESC),
    INDEX idx_user_likes (user_id, created_at DESC)
);
```

**Field Descriptions:**
- Simple junction table
- One like per user per post (enforced by unique constraint)

**Important Queries:**

**Check if user liked a post:**
```sql
SELECT EXISTS(
    SELECT 1 FROM likes 
    WHERE user_id = ? AND post_id = ?
) AS is_liked;
```

**Get users who liked a post:**
```sql
SELECT u.* FROM likes l
JOIN users u ON l.user_id = u.id
WHERE l.post_id = ?
ORDER BY l.created_at DESC
LIMIT 20;
```

**When a like is added:**
```sql
-- 1. Insert like
INSERT INTO likes (post_id, user_id) VALUES (?, ?)
ON CONFLICT (user_id, post_id) DO NOTHING;

-- 2. Update cached count
UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?;
```

**When a like is removed:**
```sql
-- 1. Delete like
DELETE FROM likes WHERE post_id = ? AND user_id = ?;

-- 2. Update cached count
UPDATE posts SET likes_count = likes_count - 1 WHERE id = ?;
```

---

### 8. comments

Comments on posts with support for nested replies.

```sql
CREATE TABLE comments (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(36) UNIQUE NOT NULL DEFAULT gen_random_uuid(),
    
    -- Relationships
    post_id BIGINT NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    parent_comment_id BIGINT NULL,  -- For nested comments/replies
    
    -- Content
    content TEXT NOT NULL,
    
    -- Status
    is_deleted BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    
    -- Cached count of replies
    replies_count INT DEFAULT 0,
    
    -- Foreign keys
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_post_comments (post_id, created_at ASC, is_deleted),
    INDEX idx_post_active_comments (post_id, created_at ASC) 
        WHERE is_deleted = FALSE,
    INDEX idx_parent_comments (parent_comment_id, created_at ASC)
        WHERE parent_comment_id IS NOT NULL,
    INDEX idx_user_comments (user_id, created_at DESC),
    
    -- Constraints
    CHECK (LENGTH(content) > 0),
    CHECK (LENGTH(content) <= 2000)
);
```

**Field Descriptions:**
- `parent_comment_id`: NULL for top-level comments, references parent for replies
- `replies_count`: Cached count of direct replies
- `is_deleted`: Soft delete for moderation

**Comment Structure:**
```
Comment (parent_comment_id = NULL)
├── Reply 1 (parent_comment_id = Comment.id)
├── Reply 2 (parent_comment_id = Comment.id)
└── Reply 3 (parent_comment_id = Comment.id)
```

**Nesting Rules:**
- Max 2 levels: Comment → Reply
- Replies cannot have replies (enforced in app logic)

**Get Comments with Replies:**
```sql
-- Get top-level comments
SELECT c.*, u.username, u.name, u.profile_pic_url
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.post_id = ? 
  AND c.parent_comment_id IS NULL
  AND c.is_deleted = FALSE
ORDER BY c.created_at ASC;

-- Get replies for a comment
SELECT c.*, u.username, u.name, u.profile_pic_url
FROM comments c
JOIN users u ON c.user_id = u.id
WHERE c.parent_comment_id = ?
  AND c.is_deleted = FALSE
ORDER BY c.created_at ASC;
```

---

### 9. notifications (Optional - v2 Feature)

User notifications for engagement events.

```sql
CREATE TABLE notifications (
    id BIGSERIAL PRIMARY KEY,
    
    -- Recipients and actors
    user_id VARCHAR(255) NOT NULL,  -- Recipient
    actor_id VARCHAR(255) NOT NULL,  -- Person who triggered notification
    
    -- Notification details
    type VARCHAR(50) NOT NULL,  -- 'like', 'comment', 'reply', 'mention', 'pin'
    target_type VARCHAR(50) NOT NULL,  -- 'post', 'comment'
    target_id BIGINT NOT NULL,  -- ID of post or comment
    
    -- Additional context
    preview_text TEXT,  -- Preview of comment/reply text
    company_id VARCHAR(255),  -- Which community this happened in
    
    -- Status
    is_read BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP NULL,
    
    -- Foreign keys
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_user_notifications (user_id, is_read, created_at DESC),
    INDEX idx_user_unread (user_id, created_at DESC) 
        WHERE is_read = FALSE,
    INDEX idx_target (target_type, target_id),
    INDEX idx_created (created_at) -- For cleanup of old notifications
);
```

**Notification Types:**
- `like`: Someone liked your post
- `comment`: Someone commented on your post
- `reply`: Someone replied to your comment
- `mention`: Someone mentioned you (future feature)
- `pin`: Admin pinned your post

**Example Query - Get Unread Notifications:**
```sql
SELECT 
    n.*,
    actor.username as actor_username,
    actor.name as actor_name,
    actor.profile_pic_url as actor_avatar
FROM notifications n
JOIN users actor ON n.actor_id = actor.id
WHERE n.user_id = ? 
  AND n.is_read = FALSE
ORDER BY n.created_at DESC
LIMIT 20;
```

---

### 10. reports (Optional - v2 Feature)

Content moderation reports from users.

```sql
CREATE TABLE reports (
    id BIGSERIAL PRIMARY KEY,
    
    -- Who and what
    reporter_id VARCHAR(255) NOT NULL,
    reported_type VARCHAR(50) NOT NULL,  -- 'post', 'comment', 'user'
    reported_id VARCHAR(255) NOT NULL,  -- ID of reported item
    company_id VARCHAR(255) NOT NULL,
    
    -- Report details
    reason VARCHAR(100) NOT NULL,  -- 'spam', 'harassment', 'inappropriate', 'other'
    description TEXT,
    
    -- Status
    status VARCHAR(50) DEFAULT 'pending',  -- 'pending', 'reviewed', 'actioned', 'dismissed'
    
    -- Review info
    reviewed_by VARCHAR(255),
    reviewed_at TIMESTAMP NULL,
    action_taken TEXT,  -- Description of action taken
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign keys
    FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_company_reports (company_id, status, created_at DESC),
    INDEX idx_company_pending (company_id, created_at DESC) 
        WHERE status = 'pending',
    INDEX idx_reported (reported_type, reported_id),
    INDEX idx_reporter (reporter_id)
);
```

**Report Reasons:**
- `spam`: Unwanted promotional content
- `harassment`: Bullying or harassment
- `inappropriate`: Inappropriate/offensive content
- `misinformation`: False or misleading information
- `other`: Other reason (requires description)

**Admin Moderation Queue:**
```sql
SELECT 
    r.*,
    reporter.username as reporter_username,
    CASE 
        WHEN r.reported_type = 'post' THEN p.content
        WHEN r.reported_type = 'comment' THEN c.content
        ELSE NULL
    END as reported_content
FROM reports r
JOIN users reporter ON r.reporter_id = reporter.id
LEFT JOIN posts p ON r.reported_type = 'post' AND r.reported_id = CAST(p.id AS VARCHAR)
LEFT JOIN comments c ON r.reported_type = 'comment' AND r.reported_id = CAST(c.id AS VARCHAR)
WHERE r.company_id = ?
  AND r.status = 'pending'
ORDER BY r.created_at ASC;
```

---

### 11. analytics_events (Optional)

Tracks engagement events for analytics dashboard.

```sql
CREATE TABLE analytics_events (
    id BIGSERIAL PRIMARY KEY,
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,  -- 'post_view', 'post_create', 'like', 'comment'
    user_id VARCHAR(255),
    company_id VARCHAR(255),
    post_id BIGINT,
    
    -- Additional context
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_company_analytics (company_id, event_type, created_at),
    INDEX idx_post_analytics (post_id, event_type, created_at),
    INDEX idx_created (created_at)  -- For partitioning/archival
);
```

**Event Types:**
- `post_view`: User viewed a post
- `post_create`: User created a post
- `like`: User liked a post
- `comment`: User commented
- `feed_view`: User viewed feed
- `filter_change`: User changed community filter

**Example Analytics Query - Posts by Day:**
```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as post_count
FROM analytics_events
WHERE company_id = ?
  AND event_type = 'post_create'
  AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date ASC;
```

**Note:** This table grows quickly. Consider:
- Partitioning by date
- Archiving old data
- Using time-series database for production

---

### 12. webhook_events

Logs webhook events from Whop for debugging and replay.

```sql
CREATE TABLE webhook_events (
    id BIGSERIAL PRIMARY KEY,
    
    -- Event details
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255),  -- Whop's event ID for deduplication
    payload JSONB NOT NULL,
    
    -- Processing status
    processed BOOLEAN DEFAULT FALSE,
    error TEXT NULL,
    retry_count INT DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL,
    
    -- Indexes
    INDEX idx_event_type (event_type, created_at),
    INDEX idx_event_id (event_id),  -- For deduplication
    INDEX idx_processed (processed, created_at),
    INDEX idx_created (created_at)  -- For cleanup
);
```

**Webhook Event Types:**
- `membership.went_valid`
- `membership.went_invalid`
- `membership.renewed`
- `app.installed`
- `app.uninstalled`
- `payment.succeeded`

**Webhook Processing Flow:**
```sql
-- 1. Check if event already processed (deduplication)
SELECT id FROM webhook_events WHERE event_id = ?;

-- 2. Insert event
INSERT INTO webhook_events (event_type, event_id, payload)
VALUES (?, ?, ?);

-- 3. Process event
-- ... business logic ...

-- 4. Mark as processed
UPDATE webhook_events 
SET processed = TRUE, processed_at = CURRENT_TIMESTAMP
WHERE id = ?;

-- 5. Or mark as failed
UPDATE webhook_events 
SET error = ?, retry_count = retry_count + 1
WHERE id = ?;
```

---

## Critical SQL Queries

### Feed Queries

#### 1. Get Unified Cross-Community Feed

```sql
-- Step 1: Get all accessible company IDs for user
WITH user_communities AS (
    SELECT company_id 
    FROM user_companies 
    WHERE user_id = $1 
      AND has_access = TRUE
      AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
)
-- Step 2: Get posts from those communities
SELECT 
    p.uuid,
    p.content,
    p.content_type,
    p.is_pinned,
    p.likes_count,
    p.comments_count,
    p.created_at,
    
    -- User data
    u.id as user_id,
    u.username,
    u.name,
    u.profile_pic_url_64 as user_avatar,
    
    -- Company data
    c.id as company_id,
    c.name as company_name,
    
    -- Check if current user liked this post
    EXISTS(
        SELECT 1 FROM likes 
        WHERE post_id = p.id AND user_id = $1
    ) as is_liked_by_user,
    
    -- Get first image if exists
    (
        SELECT json_build_object(
            'url', pm.url,
            'thumbnail_url', pm.thumbnail_url,
            'width', pm.width,
            'height', pm.height
        )
        FROM post_media pm
        WHERE pm.post_id = p.id
        ORDER BY pm.display_order
        LIMIT 1
    ) as first_image

FROM posts p
JOIN users u ON p.user_id = u.id
JOIN companies c ON p.company_id = c.id
WHERE p.company_id IN (SELECT company_id FROM user_communities)
  AND p.is_deleted = FALSE
ORDER BY 
    p.is_pinned DESC,  -- Pinned posts first
    p.created_at DESC
LIMIT $2 OFFSET $3;
```

**Parameters:**
- `$1`: Current user ID
- `$2`: Limit (e.g., 20)
- `$3`: Offset for pagination (e.g., 0, 20, 40)

**Performance:** Uses `idx_user_access` and `idx_company_active` indexes.

---

#### 2. Get Single Community Feed (Filtered)

```sql
SELECT 
    p.uuid,
    p.content,
    p.content_type,
    p.is_pinned,
    p.likes_count,
    p.comments_count,
    p.created_at,
    
    -- User data
    u.id as user_id,
    u.username,
    u.name,
    u.profile_pic_url_64 as user_avatar,
    
    -- Check if current user liked this post
    EXISTS(
        SELECT 1 FROM likes 
        WHERE post_id = p.id AND user_id = $1
    ) as is_liked_by_user,
    
    -- Get all media for this post
    COALESCE(
        (
            SELECT json_agg(
                json_build_object(
                    'url', pm.url,
                    'thumbnail_url', pm.thumbnail_url,
                    'width', pm.width,
                    'height', pm.height,
                    'alt_text', pm.alt_text
                ) ORDER BY pm.display_order
            )
            FROM post_media pm
            WHERE pm.post_id = p.id
        ),
        '[]'::json
    ) as media

FROM posts p
JOIN users u ON p.user_id = u.id
WHERE p.company_id = $2
  AND p.is_deleted = FALSE
  AND EXISTS(
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = $1 
        AND uc.company_id = $2 
        AND uc.has_access = TRUE
  )
ORDER BY 
    p.is_pinned DESC,
    p.created_at DESC
LIMIT $3 OFFSET $4;
```

**Parameters:**
- `$1`: Current user ID
- `$2`: Company ID to filter by
- `$3`: Limit
- `$4`: Offset

---

### Post Operations

#### 3. Create Post

```sql
-- Insert post
INSERT INTO posts (
    uuid,
    user_id,
    company_id,
    experience_id,
    content,
    content_type
) VALUES (
    gen_random_uuid(),
    $1,  -- user_id
    $2,  -- company_id
    $3,  -- experience_id
    $4,  -- content
    $5   -- content_type
)
RETURNING id, uuid, created_at;
```

---

#### 4. Add Media to Post

```sql
INSERT INTO post_media (
    post_id,
    media_type,
    url,
    thumbnail_url,
    width,
    height,
    file_size,
    mime_type,
    display_order,
    alt_text
) VALUES 
    ($1, 'image', $2, $3, $4, $5, $6, $7, 0, $8),
    ($1, 'image', $9, $10, $11, $12, $13, $14, 1, $15);
```

---

### Engagement Operations

#### 5. Like a Post

```sql
-- Add like (ignore if already exists)
INSERT INTO likes (post_id, user_id) 
VALUES ($1, $2)
ON CONFLICT (user_id, post_id) DO NOTHING
RETURNING id;

-- Update cached count
UPDATE posts 
SET likes_count = likes_count + 1 
WHERE id = $1
  AND NOT EXISTS (
      -- Only increment if like was actually inserted
      SELECT 1 FROM likes 
      WHERE post_id = $1 AND user_id = $2
      AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 second'
  );
```

---

#### 6. Unlike a Post

```sql
-- Delete like
DELETE FROM likes 
WHERE post_id = $1 AND user_id = $2
RETURNING id;

-- Update cached count
UPDATE posts 
SET likes_count = GREATEST(0, likes_count - 1)
WHERE id = $1;
```

---

#### 7. Add Comment

```sql
-- Insert comment
WITH new_comment AS (
    INSERT INTO comments (
        uuid,
        post_id,
        user_id,
        parent_comment_id,
        content
    ) VALUES (
        gen_random_uuid(),
        $1,  -- post_id
        $2,  -- user_id
        $3,  -- parent_comment_id (NULL for top-level)
        $4   -- content
    )
    RETURNING id, uuid, created_at
)
-- Update cached count on post
UPDATE posts 
SET comments_count = comments_count + 1 
WHERE id = $1;

-- If this is a reply, update parent comment reply count
UPDATE comments
SET replies_count = replies_count + 1
WHERE id = $3
  AND $3 IS NOT NULL;

-- Return the new comment
SELECT * FROM new_comment;
```

---

### Admin Operations

#### 8. Pin Post

```sql
-- First, check if already 3 pinned posts
WITH pinned_count AS (
    SELECT COUNT(*) as count
    FROM posts
    WHERE company_id = $1
      AND is_pinned = TRUE
      AND is_deleted = FALSE
)
-- Only pin if less than 3 already pinned
UPDATE posts
SET is_pinned = TRUE
WHERE id = $2
  AND company_id = $1
  AND (SELECT count FROM pinned_count) < 3
RETURNING id, is_pinned;
```

---

#### 9. Delete Post (Soft Delete)

```sql
UPDATE posts
SET 
    is_deleted = TRUE,
    deleted_at = CURRENT_TIMESTAMP
WHERE id = $1
  AND (
      user_id = $2  -- Post author can delete
      OR EXISTS (
          -- Or admin in this community can delete
          SELECT 1 FROM user_companies uc
          WHERE uc.user_id = $2
            AND uc.company_id = (SELECT company_id FROM posts WHERE id = $1)
            AND uc.role IN ('admin', 'owner')
      )
  )
RETURNING id;
```

---

### Analytics Queries

#### 10. Get Community Stats

```sql
SELECT 
    -- Total posts
    (SELECT COUNT(*) FROM posts 
     WHERE company_id = $1 AND is_deleted = FALSE) as total_posts,
    
    -- Total likes
    (SELECT SUM(likes_count) FROM posts 
     WHERE company_id = $1 AND is_deleted = FALSE) as total_likes,
    
    -- Total comments
    (SELECT SUM(comments_count) FROM posts 
     WHERE company_id = $1 AND is_deleted = FALSE) as total_comments,
    
    -- Active users (posted in last 7 days)
    (SELECT COUNT(DISTINCT user_id) FROM posts 
     WHERE company_id = $1 
       AND is_deleted = FALSE
       AND created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days') as active_users_7d,
    
    -- Posts in last 30 days
    (SELECT COUNT(*) FROM posts 
     WHERE company_id = $1 
       AND is_deleted = FALSE
       AND created_at >= CURRENT_TIMESTAMP - INTERVAL '30 days') as posts_30d;
```

---

## Database Maintenance

### Regular Maintenance Tasks

#### 1. Update Cached Engagement Counts

Run periodically (e.g., daily) to fix any drift:

```sql
-- Fix likes count
UPDATE posts p
SET likes_count = (
    SELECT COUNT(*) FROM likes WHERE post_id = p.id
)
WHERE p.likes_count != (SELECT COUNT(*) FROM likes WHERE post_id = p.id);

-- Fix comments count
UPDATE posts p
SET comments_count = (
    SELECT COUNT(*) FROM comments WHERE post_id = p.id AND is_deleted = FALSE
)
WHERE p.comments_count != (SELECT COUNT(*) FROM comments WHERE post_id = p.id AND is_deleted = FALSE);

-- Fix comment replies count
UPDATE comments c
SET replies_count = (
    SELECT COUNT(*) FROM comments WHERE parent_comment_id = c.id AND is_deleted = FALSE
)
WHERE c.replies_count != (SELECT COUNT(*) FROM comments WHERE parent_comment_id = c.id AND is_deleted = FALSE);
```

---

#### 2. Cleanup Old Soft-Deleted Posts

Permanently delete posts that have been soft-deleted for 30+ days:

```sql
DELETE FROM posts
WHERE is_deleted = TRUE
  AND deleted_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
```

---

#### 3. Cleanup Old Webhook Events

Keep only last 90 days:

```sql
DELETE FROM webhook_events
WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days';
```

---

#### 4. Cleanup Read Notifications

Delete notifications older than 30 days that have been read:

```sql
DELETE FROM notifications
WHERE is_read = TRUE
  AND read_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
```

---

#### 5. Update User Access Verification

Periodically verify user access (can be done via cron job):

```sql
-- Mark for re-verification if not verified in last 24 hours
UPDATE user_companies
SET last_verified = CURRENT_TIMESTAMP - INTERVAL '25 hours'
WHERE last_verified < CURRENT_TIMESTAMP - INTERVAL '24 hours'
  AND has_access = TRUE;
```

Then application code should call Whop API to verify and update.

---

## Performance Optimization

### Index Strategy

**Feed queries are critical**. The following indexes ensure fast feed generation:

1. **user_companies.idx_user_access**: Fast lookup of user's communities
2. **posts.idx_company_active**: Fast lookup of active posts in a community
3. **posts.idx_created**: Global feed order
4. **likes.unique_user_post_like**: Prevent duplicate likes, fast is_liked checks

### Query Optimization Tips

1. **Always filter `is_deleted = FALSE`** in WHERE clauses
2. **Use partial indexes** for active records only (saves 50%+ index space)
3. **Denormalize counts** (likes_count, comments_count) for read performance
4. **Use JSONB for flexible settings** without schema changes
5. **Batch webhook processing** to reduce database load

### Caching Strategy

**Cache in Redis (1-hour TTL):**
- User's accessible company IDs
- Company settings
- User profile data

**Cache in Redis (5-minute TTL):**
- Feed data (per user + filter combination)
- Pinned posts per community

**Don't cache:**
- Engagement actions (like, comment) - need real-time accuracy
- User access verification - security critical

---

## Scaling Considerations

### When to Scale

**Vertical Scaling Triggers:**
- Database CPU > 70% sustained
- Query times p95 > 500ms
- Connection pool exhaustion

**Horizontal Scaling Options:**

1. **Read Replicas**
   ```
   - All feed queries → Read replicas
   - All writes → Primary
   - Replication lag: <1 second acceptable
   ```

2. **Table Partitioning**
   ```sql
   -- Partition posts by month
   CREATE TABLE posts_2025_11 PARTITION OF posts
   FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
   ```

3. **Archive Old Data**
   ```
   - Move posts older than 1 year to archive table
   - Keep in S3 for compliance
   - Reduces main table size by 60-70%
   ```

4. **Sharding (Last Resort)**
   ```
   - Shard by company_id
   - Each shard handles subset of communities
   - Requires application-level routing
   ```

---

## Backup & Recovery

### Backup Strategy

**Automated Backups:**
- Full backup: Daily at 2 AM UTC
- Incremental backup: Every 6 hours
- WAL archiving: Continuous
- Retention: 30 days

**Critical Tables Priority:**
1. posts (most important - user content)
2. users (can be resynced from Whop)
3. companies (can be resynced from Whop)
4. likes, comments (regeneratable but preferred to keep)

### Disaster Recovery

**RTO (Recovery Time Objective):** 1 hour  
**RPO (Recovery Point Objective):** 15 minutes

**Recovery Steps:**
1. Restore from latest automated backup
2. Replay WAL logs to get within RPO
3. Resync user_companies from Whop API
4. Verify data integrity
5. Switch DNS to new instance

---

## Security Considerations

### SQL Injection Prevention

**Always use parameterized queries:**
```typescript
// ✅ Good
const posts = await db.query(
  'SELECT * FROM posts WHERE user_id = $1',
  [userId]
);

// ❌ Bad
const posts = await db.query(
  `SELECT * FROM posts WHERE user_id = '${userId}'`
);
```

### Access Control

**Never trust client input for access control:**
```sql
-- Always verify access in query
SELECT p.* FROM posts p
WHERE p.id = $1
  AND EXISTS(
      SELECT 1 FROM user_companies uc
      WHERE uc.user_id = $2
        AND uc.company_id = p.company_id
        AND uc.has_access = TRUE
  );
```

### Sensitive Data

**PII (Personally Identifiable Information) in database:**
- Email addresses (users table)
- IP addresses (if logging)
- Payment info (should never be stored - handled by Whop)

**Encryption:**
- At-rest: Enable PostgreSQL transparent data encryption
- In-transit: All connections use SSL/TLS
- Backups: Encrypted with AES-256

---

## Migration Scripts

### Initial Migration

```sql
-- migrations/001_initial_schema.sql

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create all tables in order
-- (Copy table definitions from above)

COMMIT;
```

### Sample Migration: Add Email Notifications

```sql
-- migrations/002_add_email_notifications.sql

BEGIN;

ALTER TABLE users 
ADD COLUMN email_notifications_enabled BOOLEAN DEFAULT TRUE;

ALTER TABLE notifications
ADD COLUMN email_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN email_sent_at TIMESTAMP NULL;

CREATE INDEX idx_notifications_email_pending 
ON notifications(created_at) 
WHERE email_sent = FALSE AND is_read = FALSE;

COMMIT;
```

---

## Appendix

### A. Complete Index List

```sql
-- users
CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_created ON users(created_at);

-- companies
CREATE INDEX idx_experience ON companies(experience_id);
CREATE INDEX idx_active ON companies(is_active, installed_at);

-- user_companies (CRITICAL)
CREATE UNIQUE INDEX unique_user_company ON user_companies(user_id, company_id);
CREATE INDEX idx_user_access ON user_companies(user_id, has_access);
CREATE INDEX idx_user_active_access ON user_companies(user_id, has_access, expires_at) 
    WHERE has_access = TRUE;
CREATE INDEX idx_company ON user_companies(company_id);
CREATE INDEX idx_company_active ON user_companies(company_id, has_access) 
    WHERE has_access = TRUE;
CREATE INDEX idx_membership ON user_companies(membership_id);
CREATE INDEX idx_expires ON user_companies(expires_at) 
    WHERE expires_at IS NOT NULL;

-- posts (CRITICAL)
CREATE INDEX idx_company_created ON posts(company_id, created_at DESC, is_deleted);
CREATE INDEX idx_company_active ON posts(company_id, created_at DESC) 
    WHERE is_deleted = FALSE;
CREATE INDEX idx_user_created ON posts(user_id, created_at DESC);
CREATE INDEX idx_pinned ON posts(company_id, is_pinned, created_at DESC) 
    WHERE is_pinned = TRUE AND is_deleted = FALSE;
CREATE INDEX idx_created ON posts(created_at DESC) 
    WHERE is_deleted = FALSE;
CREATE INDEX idx_content_fulltext ON posts USING GIN (to_tsvector('english', content));

-- post_media
CREATE INDEX idx_post_media ON post_media(post_id, display_order);

-- post_links
CREATE INDEX idx_post_links ON post_links(post_id);
CREATE INDEX idx_url ON post_links(url(255));

-- likes (CRITICAL)
CREATE UNIQUE INDEX unique_user_post_like ON likes(user_id, post_id);
CREATE INDEX idx_post_likes ON likes(post_id, created_at DESC);
CREATE INDEX idx_user_likes ON likes(user_id, created_at DESC);

-- comments
CREATE INDEX idx_post_comments ON comments(post_id, created_at ASC, is_deleted);
CREATE INDEX idx_post_active_comments ON comments(post_id, created_at ASC) 
    WHERE is_deleted = FALSE;
CREATE INDEX idx_parent_comments ON comments(parent_comment_id, created_at ASC)
    WHERE parent_comment_id IS NOT NULL;
CREATE INDEX idx_user_comments ON comments(user_id, created_at DESC);

-- notifications
CREATE INDEX idx_user_notifications ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX idx_user_unread ON notifications(user_id, created_at DESC) 
    WHERE is_read = FALSE;
CREATE INDEX idx_target ON notifications(target_type, target_id);
CREATE INDEX idx_created ON notifications(created_at);

-- reports
CREATE INDEX idx_company_reports ON reports(company_id, status, created_at DESC);
CREATE INDEX idx_company_pending ON reports(company_id, created_at DESC) 
    WHERE status = 'pending';
CREATE INDEX idx_reported ON reports(reported_type, reported_id);
CREATE INDEX idx_reporter ON reports(reporter_id);

-- analytics_events
CREATE INDEX idx_company_analytics ON analytics_events(company_id, event_type, created_at);
CREATE INDEX idx_post_analytics ON analytics_events(post_id, event_type, created_at);
CREATE INDEX idx_created ON analytics_events(created_at);

-- webhook_events
CREATE INDEX idx_event_type ON webhook_events(event_type, created_at);
CREATE INDEX idx_event_id ON webhook_events(event_id);
CREATE INDEX idx_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_created ON webhook_events(created_at);
```

---

### B. Database Size Estimates

**Assumptions:**
- 100,000 users
- 1,000,000 posts
- 10,000,000 likes
- 3,000,000 comments
- 50 companies

**Table Size Estimates:**

| Table | Rows | Avg Row Size | Total Size | Indexes | Total |
|-------|------|-------------|-----------|---------|--------|
| users | 100K | 500 bytes | 50 MB | 10 MB | 60 MB |
| companies | 50 | 1 KB | 50 KB | 10 KB | 60 KB |
| user_companies | 500K | 200 bytes | 100 MB | 50 MB | 150 MB |
| posts | 1M | 1 KB | 1 GB | 500 MB | 1.5 GB |
| post_media | 2M | 500 bytes | 1 GB | 100 MB | 1.1 GB |
| likes | 10M | 100 bytes | 1 GB | 500 MB | 1.5 GB |
| comments | 3M | 500 bytes | 1.5 GB | 300 MB | 1.8 GB |
| notifications | 5M | 200 bytes | 1 GB | 200 MB | 1.2 GB |

**Total Database Size: ~7-8 GB** for this scale

---

### C. References

- PostgreSQL Documentation: https://www.postgresql.org/docs/15/
- PostgreSQL Indexing Best Practices: https://www.postgresql.org/docs/15/indexes.html
- JSON in PostgreSQL: https://www.postgresql.org/docs/15/datatype-json.html
- PostgreSQL Partitioning: https://www.postgresql.org/docs/15/ddl-partitioning.html

---

**Schema Version:** 1.0  
**Last Updated:** November 2, 2025  
**Maintained By:** Development Team