'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
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
