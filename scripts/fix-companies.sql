-- Fix companies that have experience IDs as their primary key
-- We need to delete these placeholder companies and let webhooks recreate them properly

-- First, check what posts reference these bad company IDs
SELECT p.id, p.company_id, p.experience_id, p.content
FROM posts p
WHERE p.company_id LIKE 'exp_%';

-- Delete placeholder companies (those with exp_ as ID)
-- Note: This will fail if there are foreign key constraints
-- You may need to delete dependent records first or update them

-- Option 1: Delete the bad companies (if no posts reference them)
-- DELETE FROM companies WHERE id LIKE 'exp_%';

-- Option 2: Update posts to reference NULL temporarily, then delete
-- UPDATE posts SET company_id = NULL WHERE company_id LIKE 'exp_%';
-- DELETE FROM companies WHERE id LIKE 'exp_%';

-- The proper fix is to update the posts table to use the correct company_id
-- But we don't know which exp_xxx maps to which biz_xxx yet
-- That mapping comes from webhooks or needs to be manually determined
