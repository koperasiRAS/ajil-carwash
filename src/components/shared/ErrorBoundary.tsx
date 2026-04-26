'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props { children: ReactNode; fallback?: ReactNode }
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
          <h2 className="text-lg font-bold text-foreground mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {this.state.error?.message ?? 'Terjadi kesalahan yang tidak terduga.'}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            <RefreshCw className="w-4 h-4 mr-1" /> Coba Lagi
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary