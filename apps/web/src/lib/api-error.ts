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

/** Para Server Actions em produção: `instanceof ApiError` costuma falhar entre chunks; sempre use isto antes de relançar. */
export function errorMessageFromUnknown(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (typeof err === 'object' && err !== null && 'status' in err && 'message' in err) {
    const m = (err as { message?: unknown }).message;
    const st = (err as { status?: unknown }).status;
    const name = 'name' in err ? String((err as { name?: unknown }).name) : '';
    const looksApi = name === 'ApiError' || (typeof st === 'number' && typeof m === 'string');
    if (looksApi && typeof m === 'string' && m.length > 0) return m;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}
