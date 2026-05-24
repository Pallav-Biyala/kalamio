import { z } from 'zod';

// ── Auth Schemas ────────────────────────────────────────────────────

export const signupSchema = z.object({
    fullname: z.string().min(3, 'Full name must be at least 3 characters').max(50, 'Full name too long'),
    email: z.string().email('Invalid email address').max(100),
    password: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const signinSchema = z.object({
    email: z.string().min(1, 'Email or username is required').max(100),
    password: z.string().min(1, 'Password is required').max(128),
});

export const verifyEmailSchema = z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
});

export const forgotPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
    email: z.string().email('Invalid email address'),
    otp: z.string().length(6, 'OTP must be 6 digits'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters').max(128),
});

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'New password must be at least 6 characters').max(128),
});

// ── Blog Schemas ────────────────────────────────────────────────────

export const getBlogSchema = z.object({
    blog_id: z.string().min(1, 'Blog ID is required'),
    draft: z.boolean().optional(),
    mode: z.string().optional(),
});

export const likeBlogSchema = z.object({
    _id: z.string().min(1, 'Blog ID is required'),
    isLikedByUser: z.boolean(),
});

export const deleteBlogSchema = z.object({
    blog_id: z.string().min(1, 'Blog ID is required'),
});

// ── Comment Schemas ─────────────────────────────────────────────────

export const addCommentSchema = z.object({
    _id: z.string().min(1, 'Blog ID is required'),
    comment: z.string().min(1, 'Comment cannot be empty').max(5000, 'Comment too long'),
    blog_author: z.string().min(1, 'Blog author is required'),
    replying_to: z.string().optional(),
    notification_id: z.string().optional(),
});

export const deleteCommentSchema = z.object({
    _id: z.string().min(1, 'Comment ID is required'),
});

// ── User Schemas ────────────────────────────────────────────────────

export const updateProfileSchema = z.object({
    username: z.string().min(3, 'Username must be at least 3 characters').max(30),
    bio: z.string().max(150, 'Bio too long').default(''),
    social_links: z.object({
        youtube: z.string().max(200).default(''),
        instagram: z.string().max(200).default(''),
        facebook: z.string().max(200).default(''),
        twitter: z.string().max(200).default(''),
        github: z.string().max(200).default(''),
        website: z.string().max(200).default(''),
    }).optional(),
});

// ── Message Schemas ─────────────────────────────────────────────────

export const sendMessageSchema = z.object({
    content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message too long'),
    recipient_id: z.string().optional(),
    conversation_id: z.string().optional(),
}).refine(data => data.recipient_id || data.conversation_id, {
    message: 'Either recipient_id or conversation_id is required',
});

// ── Pagination Schema (reusable) ────────────────────────────────────

export const paginationSchema = z.object({
    page: z.number().int().min(1).default(1),
}).passthrough(); // Allow additional fields
