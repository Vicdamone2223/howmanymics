'use client';
import React from 'react';

type State = { hasError: boolean; message?: string };

export default class ErrorBoundary extends React.Component<
  React.PropsWithChildren<{}>,
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(err: unknown) {
    // log to console so we actually see it in dev
    // eslint-disable-next-line no-console
    console.error('App error boundary caught:', err);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-xl p-6">
          <h1 className="text-xl font-bold mb-2">Something broke</h1>
          <p className="text-sm opacity-80">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}
