import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleResetSession = () => {
    try {
      localStorage.removeItem('app_active_session');
    } catch {}
    window.location.href = window.location.pathname;
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-[#0a0503] flex items-center justify-center p-4 text-white select-none">
          <div className="max-w-md w-full bg-zinc-900/90 border border-amber-500/40 rounded-2xl p-6 text-center shadow-2xl shadow-amber-500/10 backdrop-blur-md">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8 animate-pulse" />
            </div>

            <h2 className="text-xl font-black font-display text-amber-300 mb-2">
              Screen Display Recovered
            </h2>
            <p className="text-xs text-zinc-300 mb-6 leading-relaxed">
              Screen ko recover kar liya gaya hai. Agar koi cache ya session atka hua tha to aap niche diye button se turant Login screen par jaa sakte hain.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleResetSession}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold text-sm hover:brightness-110 active:scale-95 transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Go To Login Screen (Reset Session)
              </button>

              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-xs active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Page
              </button>
            </div>

            {this.state.error && (
              <div className="mt-4 p-2 bg-black/60 rounded border border-zinc-800 text-[10px] font-mono text-zinc-500 text-left overflow-auto max-h-24">
                {this.state.error.message}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
