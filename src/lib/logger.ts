type LogLevel = 'info' | 'warn' | 'error'

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[INFO] ${new Date().toISOString()}`, message, context ?? '')
    }
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.warn(`[WARN] ${new Date().toISOString()}`, message, context ?? '')
  },
  error(message: string, context?: Record<string, unknown>) {
    console.error(`[ERROR] ${new Date().toISOString()}`, message, context ?? '')
  },
}
