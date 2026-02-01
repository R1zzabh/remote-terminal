import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
    children?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="error-screen" style={{
                    height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', background: '#050505', color: '#ff4444',
                    padding: '40px', textAlign: 'center'
                }}>
                    <h1 style={{ fontSize: '48px', marginBottom: '20px' }}>SYSTEM HALTED</h1>
                    <p style={{ color: '#888', marginBottom: '40px', maxWidth: '600px' }}>
                        A critical error has occurred in the Ryo Terminal subsystem.
                        The current state has been isolated to prevent further damage.
                    </p>
                    <pre style={{
                        background: 'rgba(255, 68, 68, 0.1)', padding: '20px', borderRadius: '12px',
                        fontSize: '12px', overflow: 'auto', maxWidth: '80%', marginBottom: '40px'
                    }}>
                        {this.state.error?.message}
                    </pre>
                    <button
                        onClick={() => window.location.reload()}
                        style={{
                            background: '#fff', color: '#000', border: 'none', padding: '12px 24px',
                            borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        REBOOT SYSTEM
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
