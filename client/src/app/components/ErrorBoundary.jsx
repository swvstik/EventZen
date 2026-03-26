import { Component } from 'react';
import { Link } from 'react-router-dom';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-neo-white p-6">
          <div className="neo-card p-10 max-w-lg text-center">
            <div className="w-20 h-20 bg-neo-red border-3 border-neo-black shadow-neo mx-auto mb-6
                          flex items-center justify-center font-heading-shade text-3xl text-white">
              !
            </div>
            <h1 className="font-heading text-2xl uppercase tracking-wider mb-3">
              Something Went Wrong
            </h1>
            <p className="font-body text-sm text-neo-black/65 mb-6">
              An unexpected error occurred. This has been logged.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="text-left p-4 bg-neo-cream border-3 border-neo-black text-[11px] font-body
                            overflow-auto max-h-40 mb-6">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex justify-center gap-4">
              <button
                onClick={this.handleReset}
                className="neo-btn bg-neo-yellow"
              >
                Try Again
              </button>
              <a href="/" className="neo-btn bg-neo-white">
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
