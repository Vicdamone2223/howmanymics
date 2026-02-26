'use client';

import React from 'react';

type State = { hasError: boolean; info?: string };

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    // Log a readable report
    // eslint-disable-next-line no-console
    console.error('[App ErrorBoundary]', error, info?.componentStack);
    this.setState({ info: String(error) });
  }

  handleReset = () => {
    this.setState({ hasError: false, info: undefined });
    // safest: full reload (in case global state is hosed)
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="p-4 m-4 rounded-lg border border-red-500/40 bg-red-900/10 text-red-200">
        <div className="font-bold mb-1">Something crashed on this page.</div>
        <div className="text-sm opacity-80">
          Check the console for <code>[App ErrorBoundary]</code> for details.
        </div>
        <button
          onClick={this.handleReset}
          className="mt-3 px-3 py-1.5 rounded bg-red-500 text-black font-bold"
        >
          Reload page
        </button>
      </div>
    );
  }
}
