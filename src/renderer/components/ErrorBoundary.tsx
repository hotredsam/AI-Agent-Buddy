import React from 'react'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallbackMessage?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="error-boundary-content">
            <span className="error-boundary-icon">{'\u26A0'}</span>
            <h3>Something went wrong</h3>
            <p className="error-boundary-message">
              {this.props.fallbackMessage || this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button className="error-boundary-btn" onClick={this.handleReload}>
              Try Again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
