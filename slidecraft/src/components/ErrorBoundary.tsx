import { Component, type ReactNode } from 'react';
import { tr } from '@/i18n';

export class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error) { console.error('[SlideCraft] UI error:', error); }
  render() {
    if (!this.state.error) return this.props.children;
    return this.props.fallback ?? (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <h1 className="text-lg font-semibold">{tr('Something went wrong')}</h1>
        <p className="max-w-lg text-sm text-ink-500">{this.state.error.message}</p>
        <p className="text-xs text-ink-400">{tr('Your work is saved locally. Reload to continue.')}</p>
        <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm text-white" onClick={() => location.reload()}>{tr('Reload')}</button>
      </div>
    );
  }
}
