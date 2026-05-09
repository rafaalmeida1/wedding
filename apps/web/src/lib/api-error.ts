export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function extractMessage(data: unknown, fallback: string): string {
  if (data && typeof data === 'object' && 'message' in data) {
    const m = (data as { message?: unknown }).message;
    if (typeof m === 'string' && m.length > 0) return m;
  }
  return fallback;
}

export function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
