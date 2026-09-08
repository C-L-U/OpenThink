import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { useStore } from '../store';
import { translate } from '../i18n';

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

    // Class component: read the language imperatively instead of via hook.
    const t = (key: Parameters<typeof translate>[1]) =>
      translate(useStore.getState().language, key);

    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-base px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-900/60 bg-red-950/30">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-strong">{t('error.title')}</h1>
          <p className="mt-1 max-w-md text-sm text-muted">{t('error.body')}</p>
          <p className="mx-auto mt-3 max-w-md truncate rounded-lg border border-edge bg-inset px-3 py-1.5 font-mono text-xs text-red-400/80" title={error.message}>
            {error.message}
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={this.retry}
            className="rounded-lg bg-strong px-4 py-2 text-sm font-medium text-[rgb(var(--c-bg))] transition hover:opacity-90 active:scale-95"
          >
            {t('error.tryAgain')}
          </button>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition hover:border-faint hover:text-strong active:scale-95"
          >
            {t('error.reload')}
          </button>
        </div>
      </div>
    );
  }
}
