'use client';
import React from 'react';

export default class AppErrorBoundary extends React.Component<
  { children: React.ReactNode }, { hasError: boolean; note?: string }
> {
  constructor(props:any){ super(props); this.state = { hasError:false }; }
  static getDerivedStateFromError(err:any){ return { hasError:true, note:String(err?.message||err) }; }
  componentDidCatch(err:any, info:any){ console.error('App error boundary:', err, info); }
  render(){
    if(this.state.hasError){
      return (
        <main className="mx-auto max-w-3xl px-4 py-8">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="opacity-75 text-sm mt-2">{this.state.note}</p>
          <p className="opacity-60 text-xs mt-2">If this sticks after reload, the UI caught a runtime error.</p>
        </main>
      );
    }
    return this.props.children;
  }
}
