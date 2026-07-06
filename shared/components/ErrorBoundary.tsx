// Catches render-time errors anywhere below it so a single thrown component
// can't white-screen the whole SPA — critical for the unattended kiosk iPad.
// React only surfaces render errors through a class component, so this stays a
// class by necessity. Wire Sentry (or similar) into componentDidCatch later.
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  // Optional custom fallback; receives the error and a reset() to retry render.
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Central place to report to an error-monitoring service.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => this.setState({ error: null });

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        role="alert"
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 24,
          textAlign: 'center',
          fontFamily: "'Montserrat', system-ui, sans-serif",
          background: '#ffffff',
          color: '#141414',
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 800 }}>Something went wrong</div>
        <p style={{ margin: 0, maxWidth: 420, color: '#686868', fontSize: 15 }}>
          The page hit an unexpected error. Reloading usually fixes it — if it keeps
          happening, let us know.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            height: 44,
            padding: '0 22px',
            borderRadius: 10,
            border: 'none',
            background: '#141414',
            color: '#ffffff',
            fontWeight: 700,
            fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Reload page
        </button>
      </div>
    );
  }
}
