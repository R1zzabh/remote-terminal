import { useEffect, useRef, useState, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { CommandPalette } from "./CommandPalette";

const THEMES = {
    dark: { background: "#050505", foreground: "#e0e0e0", cursor: "#00ff88" },
    matrix: { background: "#000500", foreground: "#00ff41", cursor: "#00ff41" },
    nord: { background: "#2e3440", foreground: "#d8dee9", cursor: "#88c0d0" },
    solarized: { background: "#002b36", foreground: "#839496", cursor: "#268bd2" },
};

interface TerminalComponentProps {
    token: string;
    onLogout: () => void;
}

export function TerminalComponent({ token, onLogout }: TerminalComponentProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const termRef = useRef<Terminal | null>(null);
    const reconnectTimeoutRef = useRef<number | null>(null);

    const [status, setStatus] = useState<"connecting" | "connected" | "disconnected" | "error">("connecting");
    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [theme, setTheme] = useState<keyof typeof THEMES>("dark");

    const connect = useCallback(() => {
        if (!token) return;
        if (wsRef.current) wsRef.current.close();

        const ws = new WebSocket("ws://localhost:3001/ws");
        wsRef.current = ws;
        setStatus("connecting");

        ws.onopen = () => {
            setStatus("connected");
            if (termRef.current) {
                termRef.current.write("\r\n\x1b[32m[SYSTEM]\x1b[0m Connected to Ryo Terminal Server\r\n");
            }
            ws.send(JSON.stringify({ type: "auth", token }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "output" && termRef.current) {
                    termRef.current.write(msg.data);
                } else if (msg.type === "authenticated" && termRef.current) {
                    termRef.current.write("\x1b[32m[AUTH]\x1b[0m Access Granted!\r\n");

                    termRef.current.onData(data => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "input", data }));
                        }
                    });

                    const handleResize = () => {
                        if (termRef.current && ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({
                                type: "resize",
                                cols: termRef.current.cols,
                                rows: termRef.current.rows
                            }));
                        }
                    };
                    window.addEventListener('resize', handleResize);
                } else if (msg.type === "error" && termRef.current) {
                    termRef.current.write(`\r\n\x1b[31m[ERROR]\x1b[0m ${msg.message}\r\n`);
                    if (msg.message.includes("Invalid token")) onLogout();
                }
            } catch (e) {
                console.error("WS Message Error:", e);
            }
        };

        ws.onclose = () => {
            setStatus("disconnected");
            if (termRef.current) {
                termRef.current.write("\r\n\x1b[33m[SYSTEM]\x1b[0m Connection lost. Retrying...\r\n");
            }
            reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
        };

        ws.onerror = () => setStatus("error");
    }, [token, onLogout]);

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: THEMES[theme],
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            fontSize: 14,
            allowProposedApi: true
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(terminalRef.current);
        fitAddon.fit();
        termRef.current = term;

        connect();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) wsRef.current.close();
            term.dispose();
        };
    }, [connect]); // Only run once on mount

    useEffect(() => {
        if (termRef.current) {
            termRef.current.options.theme = THEMES[theme];
        }
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme]);

    useEffect(() => {
        const handleKeys = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'p') {
                e.preventDefault();
                setIsPaletteOpen(true);
            }
        };
        window.addEventListener('keydown', handleKeys);
        return () => window.removeEventListener('keydown', handleKeys);
    }, []);

    const handleAction = (action: string) => {
        if (action.startsWith('theme-')) {
            setTheme(action.replace('theme-', '') as keyof typeof THEMES);
        } else if (action === 'clear') {
            termRef.current?.clear();
        } else if (action === 'logout') {
            onLogout();
        } else if (action === 'status') {
            connect();
        }
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh", background: "#050505", display: "flex", flexDirection: "column" }}>
            <div className="terminal-header" style={{ padding: '8px 16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div className="terminal-title" style={{ fontWeight: 'bold' }}>Ryo Terminal</div>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <div className="connection-status" style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div className={`status-dot ${status === "connected" ? "connected" : ""}`} />
                        &nbsp; {status.toUpperCase()}
                    </div>
                    <button onClick={onLogout} className="control-btn" style={{ fontSize: '11px', padding: '4px 10px' }}>Logout</button>
                </div>
            </div>
            <div className="terminal-wrapper" style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                <div ref={terminalRef} className="xterm-container" style={{ width: '100%', height: '100%' }} />
            </div>
            <CommandPalette
                isOpen={isPaletteOpen}
                onClose={() => setIsPaletteOpen(false)}
                onAction={handleAction}
            />
        </div>
    );
}
