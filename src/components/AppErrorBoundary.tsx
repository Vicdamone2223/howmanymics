'use client';

import React from 'react';

type State = { hasError: boolean; err?: any };

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: any) {
    return { hasError: true, err };
  }

  componentDidCatch(err: any, info: any) {
    // surface to console too
    console.error('Caught by ErrorBoundary:', err, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20 }}>
          <h2 style={{ fontWeight: 800, marginBottom: 8 }}>Something crashed</h2>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              background: '#111',
              border: '1px solid #333',
              padding: 12,
              borderRadius: 8,
              color: '#fca5a5',
            }}
          >
            {String(this.state.err?.message || this.state.err || 'Unknown error')}
          </pre>
          <p style={{ opacity: 0.75, marginTop: 8 }}>
            If this appears only when logged in or after switching tabs, the crash is likely in a
            client effect that runs on auth/session restore.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
