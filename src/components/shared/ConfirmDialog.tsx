'use client'

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  onConfirm: () => void
  onCancel?: () => void
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
  loading?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  confirmLabel = 'Konfirmasi',
  cancelLabel = 'Batal',
  variant = 'default',
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'max-w-sm',
        variant === 'danger' ? 'border-red-800' : 'border-border'
      )}>
        <DialogHeader>
          {variant === 'danger' && (
            <div className="mb-2">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
            </div>
          )}
          <DialogTitle className={variant === 'danger' ? 'text-center text-red-400' : ''}>
            {title}
          </DialogTitle>
          {description && (
            <DialogDescription className={cn(
              'text-center',
              variant === 'danger' ? 'text-red-400/80' : ''
            )}>
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className={variant === 'danger' ? 'flex-col sm:flex-col gap-2' : ''}>
          <Button
            variant="outline"
            onClick={() => {
              onCancel?.()
              onOpenChange(false)
            }}
            disabled={loading}
            className={cn(variant === 'danger' ? 'w-full' : '')}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              variant === 'danger'
                ? 'w-full bg-red-600 hover:bg-red-500 text-white border-red-700'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            )}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ConfirmDialog