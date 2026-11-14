import { z } from 'zod';

export const RegisterBody = z.object({ email: z.string().trim().toLowerCase().email().max(200), password: z.string().min(8, 'Password must be at least 8 characters').max(200), name: z.string().trim().min(1).max(100) });
export const LoginBody = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(200) });

const data = z.record(z.string(), z.unknown()).refine((d) => Array.isArray((d as { slides?: unknown }).slides), { message: 'data.slides must be an array' });
const thumbnail = z.string().max(300 * 1024, 'thumbnail must be ≤ 300KB').regex(/^data:image\/(png|jpeg|webp);base64,/, 'thumbnail must be a PNG/JPEG/WebP data URL').optional();

export const CreatePresentationBody = z.object({ title: z.string().trim().min(1).max(300).optional(), description: z.string().max(5000).optional(), data, thumbnail });
export const SavePresentationBody = z.object({ title: z.string().trim().min(1).max(300).optional(), description: z.string().max(5000).optional(), data, thumbnail, snapshot: z.boolean().optional(), baseVersion: z.number().int().optional() });
export const PatchPresentationBody = z.object({
  title: z.string().trim().min(1).max(300).optional(), description: z.string().max(5000).optional(),
  status: z.enum(['draft', 'exported', 'shared', 'archived']).optional(), visibility: z.enum(['private', 'link', 'public']).optional(), thumbnail,
}).refine((b) => Object.keys(b).length > 0, { message: 'Nothing to update' });
export const ShareBody = z.object({ visibility: z.enum(['private', 'link', 'public']) });
export const ListQuery = z.object({
  q: z.string().max(200).optional(), status: z.enum(['draft', 'exported', 'shared', 'archived', 'all']).optional(),
  sort: z.enum(['updated', 'created', 'title']).optional(), limit: z.coerce.number().int().min(1).max(200).optional(),
});
export const ExportBody = z.object({ format: z.enum(['pptx', 'pdf', 'png', 'jpeg', 'svg', 'json', 'html', 'mp4', 'webm']), profile: z.string().max(60).optional(), warnings: z.array(z.string().max(500)).max(500).optional() });
export const ImportBody = z.object({ format: z.string().max(20), slides: z.number().int().min(0), errors: z.number().int().min(0).default(0), warnings: z.number().int().min(0).default(0), title: z.string().max(300).optional() });
export const MediaQuery = z.object({ q: z.string().trim().min(1).max(200), orientation: z.enum(['landscape', 'portrait', 'squarish', '']).optional(), provider: z.enum(['unsplash', 'pexels', 'pixabay', 'openverse', 'wikimedia', '']).optional(), page: z.coerce.number().int().min(1).max(20).optional() });
export const AiBody = z.object({ provider: z.enum(['openai', 'anthropic', 'gemini', 'deepseek', 'openrouter']).optional(), task: z.string().max(60), input: z.string().max(100000) });
