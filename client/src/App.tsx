import { useState } from "react";
import { Login } from "./components/Login";
import { TerminalComponent } from "./components/Terminal";
import { ErrorBoundary } from "./components/ErrorBoundary";

function App() {
    const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

    const handleLogin = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem("token", newToken);
    };

    const handleLogout = () => {
        setToken(null);
        localStorage.clear();
    };

    return (
        <ErrorBoundary>
            <div className="app-container" style={{
                height: "100vh", width: "100vw", overflow: "hidden",
                animation: "fadeIn 0.5s ease"
            }}>
                <style>{`
                    @keyframes fadeIn {
                        from { opacity: 0; }
                        to { opacity: 1; }
                    }
                `}</style>
                {token ? (
                    <TerminalComponent token={token} onLogout={handleLogout} />
                ) : (
                    <Login onLogin={handleLogin} />
                )}
            </div>
        </ErrorBoundary>
    );
}

export default App;
