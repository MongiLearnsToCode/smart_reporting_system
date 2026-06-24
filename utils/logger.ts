export function logError(context: string, error: unknown, meta?: Record<string, unknown>) {
  const entry = {
    level: 'error',
    context,
    timestamp: new Date().toISOString(),
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    ...meta,
  };
  console.error(JSON.stringify(entry));
}

export function logInfo(context: string, message: string, meta?: Record<string, unknown>) {
  const entry = {
    level: 'info',
    context,
    timestamp: new Date().toISOString(),
    message,
    ...meta,
  };
  console.log(JSON.stringify(entry));
}
