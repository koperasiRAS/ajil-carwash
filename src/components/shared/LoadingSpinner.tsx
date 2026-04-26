'use client'

import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  label?: string
}

export function LoadingSpinner({ size = 'md', className, label }: LoadingSpinnerProps) {
  // If it's used in a small space, we render a simple inline skeleton
  if (size === 'sm') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className="h-4 w-4 skeleton rounded-full" />
        {label && <div className="h-4 w-16 skeleton rounded" />}
      </div>
    )
  }

  // Otherwise we render a block-style skeleton
  return (
    <div className={cn('flex flex-col gap-3 w-full', className)}>
      {label && <span className="text-sm text-muted-foreground font-medium">{label}</span>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-3 flex flex-col justify-between h-[80px]">
            <div className="h-4 w-3/4 skeleton rounded" />
            <div className="flex justify-between items-center mt-2">
              <div className="h-4 w-1/3 skeleton rounded" />
              <div className="h-6 w-6 skeleton rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function LoadingOverlay({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center z-20 rounded-xl">
      <div className="flex flex-col items-center gap-4 p-6 bg-card border border-border shadow-lg rounded-xl min-w-[200px]">
         <div className="h-8 w-8 skeleton rounded-full" />
         {label && <div className="h-4 w-24 skeleton rounded" />}
      </div>
    </div>
  )
}

export default LoadingSpinner