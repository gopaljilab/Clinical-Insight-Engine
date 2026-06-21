import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw, Mail } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });
    
    // Log to console for local debugging
    console.error("[ErrorBoundary] Uncaught render error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo.componentStack);

    // Send error details to backend logger
    try {
      fetch("/api/logs/client-error", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: (error as Error).message,
          stack: (error as Error).stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
          timestamp: new Date().toISOString(),
        }),
      }).catch(err => console.error("Failed to send client error log:", err));
    } catch (e) {
      console.error("Error boundary logging failed:", e);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 md:p-8">
          <div className="w-full max-w-xl rounded-2xl bg-white p-8 text-center shadow-xl border border-slate-200">
            <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-red-100">
              <AlertTriangle className="h-12 w-12 text-red-600" />
            </div>
            
            <h1 className="mb-3 text-3xl font-black tracking-tight text-slate-900">
              Something went wrong
            </h1>
            
            <p className="mb-8 text-lg text-slate-500">
              We've encountered an unexpected error and have been notified. Please try refreshing the page or contact support if the issue persists.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: null });
                  window.location.reload();
                }}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition-all focus:outline-none focus:ring-4 focus:ring-blue-600/20"
              >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Reload Page
              </button>
              
              <a 
                href={`mailto:support@clinical-insight.dev?subject=Crash Report&body=Error: ${this.state.error?.message}%0D%0AURL: ${window.location.href}`}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 hover:text-slate-900 transition-all focus:outline-none focus:ring-4 focus:ring-slate-200"
              >
                <Mail className="mr-2 h-4 w-4" />
                Contact Support
              </a>
            </div>

            {process.env.NODE_ENV !== "production" && this.state.error && (
              <div className="mt-8 text-left border border-red-100 rounded-xl bg-red-50/50 p-4 overflow-hidden">
                <h3 className="text-sm font-bold text-red-900 mb-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  Developer Error Details
                </h3>
                <p className="text-xs font-mono font-bold text-red-800 break-words mb-3">
                  {this.state.error.message}
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg bg-red-950/5 border border-red-900/10 p-3">
                  <pre className="text-[10px] font-mono leading-relaxed text-red-800/80 whitespace-pre-wrap">
                    {this.state.error.stack}
                    {"\n\n--- Component Stack ---\n"}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
