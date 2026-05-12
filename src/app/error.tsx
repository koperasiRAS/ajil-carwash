'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logger } from '@/lib/logger'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    logger.error('Global error boundary', { message: error.message, digest: error.digest })
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] py-16 text-center">
      <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
      <h2 className="text-lg font-bold text-foreground mb-2">Terjadi Kesalahan Server</h2>
      <p className="text-sm text-muted-foreground mb-4 max-w-sm">
        {error.message || 'Terjadi kesalahan pada sistem. Silakan coba lagi.'}
      </p>
      <Button size="sm" variant="outline" onClick={() => reset()}>
        <RefreshCw className="w-4 h-4 mr-2" /> Coba Lagi
      </Button>
    </div>
  )
}
