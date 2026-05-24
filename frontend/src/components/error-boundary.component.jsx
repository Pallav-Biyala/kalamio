import { Component } from 'react';

/**
 * React Error Boundary — catches render errors in child component tree.
 * Prevents a single component crash from taking down the entire app.
 * Must be a class component (hooks don't support componentDidCatch).
 */
class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '60vh',
                    padding: '2rem',
                    textAlign: 'center',
                    fontFamily: "'DM Sans', sans-serif",
                }}>
                    <h2 style={{
                        fontSize: '1.5rem',
                        fontWeight: 600,
                        marginBottom: '1rem',
                        color: 'var(--text-primary, #f5f5f5)',
                    }}>
                        Something went wrong
                    </h2>
                    <p style={{
                        fontSize: '0.95rem',
                        color: 'var(--text-secondary, #a0a0a0)',
                        marginBottom: '1.5rem',
                        maxWidth: '400px',
                    }}>
                        An unexpected error occurred. Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            padding: '0.6rem 1.5rem',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'var(--accent, #6366f1)',
                            color: '#fff',
                            fontSize: '0.9rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontFamily: "'DM Sans', sans-serif",
                        }}
                    >
                        Refresh Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
