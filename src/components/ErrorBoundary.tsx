import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/** Catches render errors so one bad view does not blank the entire app. */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, message: err.message || 'Something went wrong.' };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-lg border border-border bg-card p-6 shadow-sm space-y-3">
            <h1 className="text-lg font-semibold text-text-primary">Something broke</h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              The UI crashed while rendering. You can reload the page. If this happens when opening a screen, try again
              after a moment — a large data request may have timed out.
            </p>
            <pre className="text-xs text-ems-coral bg-ems-coral/10 rounded p-3 overflow-auto max-h-32 whitespace-pre-wrap">
              {this.state.message}
            </pre>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md bg-ems-accent text-background px-4 py-2 text-sm font-medium hover:bg-ems-accent/90"
              onClick={() => globalThis.location.reload()}
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
