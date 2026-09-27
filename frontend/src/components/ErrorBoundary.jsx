import React from 'react';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('CogniPath ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.hash = '';
    window.location.pathname = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[500px] h-full w-full flex items-center justify-center p-6 bg-[#0A0D1C] text-[#ECEDF7]">
          <div
            style={{
              boxShadow: '0 24px 60px -12px rgba(0, 0, 0, 0.75), 0 0 40px rgba(139, 124, 255, 0.12)'
            }}
            className="w-full max-w-lg bg-[#12162B] border border-[#262C4C] rounded-3xl p-7 text-center space-y-5"
          >
            <div className="h-14 w-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400 shadow-lg">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="font-heading text-xl font-bold text-[#ECEDF7]">
                Something went wrong displaying this view
              </h2>
              <p className="text-xs text-[#8A90B4] leading-relaxed">
                An unexpected interface state occurred. Don't worry, your enrolled courses and progress are safely preserved.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-[#0A0D1C] border border-[#262C4C] text-[11px] text-rose-300 font-mono text-left overflow-x-auto max-h-24">
                {this.state.error.message}
              </div>
            )}

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#6C5CE7] hover:from-[#9d91ff] hover:to-[#7d6ef7] text-white font-bold text-xs uppercase tracking-wider transition flex items-center gap-2 cursor-pointer shadow-md"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reload Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-full bg-[#171C36] hover:bg-[#1f2648] border border-[#262C4C] text-[#8A90B4] hover:text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer"
              >
                <Home className="h-3.5 w-3.5" />
                <span>Home</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
