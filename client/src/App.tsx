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
        <div style={{ width: "100%", height: "100vh" }}>
            {token ? (
                <TerminalComponent token={token} onLogout={handleLogout} />
            ) : (
                <Login onLogin={handleLogin} />
            )}
        </div>
    );
}

export default App;
