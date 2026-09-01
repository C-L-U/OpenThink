import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort crash guard: a render error anywhere in the tree shows a
 * recovery screen instead of a blank page. "Try again" resets the boundary
 * (the Zustand store survives, so no state is lost); "Reload" is the
 * nuclear option and is never required.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('OpenThink render crash:', error, info.componentStack);
  }

  private retry = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#171717] px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/60 bg-red-950/30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">Something went wrong</h1>
          <p className="mt-1 max-w-md text-sm text-zinc-500">
            The interface hit an unexpected error, but your settings and keys are intact — no need
            to reload the page.
          </p>
          <p className="mx-auto mt-3 max-w-md truncate rounded-lg border border-neutral-800 bg-[#111111] px-3 py-1.5 font-mono text-xs text-red-400/80" title={error.message}>
            {error.message}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={this.retry}
            className="rounded-lg bg-neutral-100 px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-white active:scale-95"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-zinc-400 transition hover:border-neutral-500 hover:text-zinc-200 active:scale-95"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
