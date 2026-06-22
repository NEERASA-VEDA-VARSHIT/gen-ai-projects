import { z } from 'zod';

const envSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required').optional(),
  GEMINI_EMBEDDING_MODEL: z.string().default('gemini-embedding-2'),
  GEMINI_CHAT_MODEL: z.string().default('gemini-2.5-flash'),
  GEMINI_EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),
  UPLOAD_MAX_FILE_MB: z.coerce.number().int().positive().default(10),
  UPLOAD_RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().positive().default(5),
  UPLOAD_RATE_LIMIT_WINDOW_SECONDS: z.coerce.number().int().positive().default(60),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);