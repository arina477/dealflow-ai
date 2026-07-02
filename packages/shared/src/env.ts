import type { z } from 'zod';

export function parseEnv<T extends z.ZodTypeAny>(
  schema: T,
  source: Record<string, string | undefined> = process.env
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Environment validation failed:\n${issues}`);
  }
  return result.data as z.infer<T>;
}
