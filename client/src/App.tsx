import { useState, useEffect } from "react";
import { Login } from "./components/Login";
import { TerminalComponent } from "./components/Terminal";

function App() {
    const [token, setToken] = useState<string | null>(localStorage.getItem("token"));

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        if (storedToken) {
            setToken(storedToken);
        }
    }, []);

    const handleLogin = (newToken: string) => {
        localStorage.setItem("token", newToken);
        setToken(newToken);
    };

    const handleLogout = () => {
        localStorage.removeItem("token");
        setToken(null);
    };

    return (
        <div style={{
            height: "100vh",
            width: "100vw",
            background: "#050505",
            animation: "fadeIn 0.5s ease-out"
        }}>
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }
            `}</style>
            {!token ? (
                <Login onLogin={handleLogin} />
            ) : (
                <TerminalComponent token={token} onLogout={handleLogout} />
            )}
        </div>
    );
}

export default App;
