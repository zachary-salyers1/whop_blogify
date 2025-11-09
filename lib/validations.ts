import { z } from 'zod'

// Post validations
export const createPostSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title must be less than 200 characters'),
  content: z.string().min(1, 'Post content is required').max(50000, 'Post content must be less than 50000 characters'),
  contentType: z.enum(['text', 'image', 'video', 'link']).default('text'),
  images: z.array(z.object({
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    fileSize: z.number().optional(),
    mimeType: z.string().optional(),
    altText: z.string().max(500).optional()
  })).max(4, 'Maximum 4 images per post').optional(),
  videos: z.array(z.object({
    url: z.string().url(),
    thumbnailUrl: z.string().url().optional(),
    width: z.number().optional(),
    height: z.number().optional(),
    fileSize: z.number().optional(),
    mimeType: z.string().optional(),
    duration: z.number().optional()
  })).max(1, 'Maximum 1 video per post').optional()
})

export const updatePostSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).max(50000).optional(),
  isPinned: z.boolean().optional()
})

// Comment validations
export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required').max(2000, 'Comment must be less than 2000 characters'),
  parentCommentId: z.string().optional()
})

export const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000)
})

// Feed query validations
export const feedQuerySchema = z.object({
  companyId: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20)
})

// Admin settings validation
export const companySettingsSchema = z.object({
  display_name: z.string().max(255).optional(),
  primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logo_url: z.string().url().optional(),
  posting_permission: z.enum(['all_members', 'admins_only']).default('all_members'),
  allow_images: z.boolean().default(true),
  allow_links: z.boolean().default(true),
  max_images_per_post: z.number().int().min(1).max(10).default(4)
})

export type CreatePostInput = z.infer<typeof createPostSchema>
export type UpdatePostInput = z.infer<typeof updatePostSchema>
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>
export type FeedQuery = z.infer<typeof feedQuerySchema>
export type CompanySettings = z.infer<typeof companySettingsSchema>
