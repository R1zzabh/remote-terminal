import { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";

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

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: "#0f0f0f",
                foreground: "#e0e0e0",
                cursor: "#00ff00",
                selectionBackground: "rgba(255, 255, 255, 0.3)",
            },
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

        const connect = () => {
            if (wsRef.current) wsRef.current.close();

            const ws = new WebSocket("ws://localhost:3001/ws");
            wsRef.current = ws;
            setStatus("connecting");

            ws.onopen = () => {
                setStatus("connected");
                term.write("\r\n\x1b[32m[SYSTEM]\x1b[0m Connected to Ryo Terminal Server\r\n");
                ws.send(JSON.stringify({ type: "auth", token }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === "output") {
                        term.write(msg.data);
                    } else if (msg.type === "authenticated") {
                        term.write("\x1b[32m[AUTH]\x1b[0m Access Granted!\r\n");

                        // Set up input handling only once after auth
                        term.onData(data => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ type: "input", data }));
                            }
                        });

                        const handleResize = () => {
                            fitAddon.fit();
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({
                                    type: "resize",
                                    cols: term.cols,
                                    rows: term.rows
                                }));
                            }
                        };
                        window.addEventListener('resize', handleResize);
                        setTimeout(handleResize, 100);
                    } else if (msg.type === "error") {
                        term.write(`\r\n\x1b[31m[ERROR]\x1b[0m ${msg.message}\r\n`);
                        if (msg.message.includes("Invalid token")) {
                            onLogout();
                        }
                    }
                } catch (e) {
                    console.error("WS Message Error:", e);
                }
            };

            ws.onclose = () => {
                setStatus("disconnected");
                term.write("\r\n\x1b[33m[SYSTEM]\x1b[0m Connection lost. Retrying in 3s...\r\n");
                reconnectTimeoutRef.current = window.setTimeout(connect, 3000);
            };

            ws.onerror = (err) => {
                console.error("WS Error:", err);
                setStatus("error");
            };
        };

        connect();

        return () => {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            if (wsRef.current) wsRef.current.close();
            term.dispose();
        };
    }, [token, onLogout]);

    return (
        <div style={{ position: "relative", width: "100%", height: "100vh", background: "#050505", display: "flex", flexDirection: "column" }}>
            <div className="terminal-header">
                <div className="terminal-title">Ryo Terminal</div>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                    <div className="connection-status">
                        <div className={`status-dot ${status === "connected" ? "connected" : ""}`} />
                        &nbsp; {status.toUpperCase()}
                    </div>
                    <button
                        onClick={onLogout}
                        style={{
                            background: "transparent",
                            border: "1px solid var(--glass-border)",
                            color: "var(--text-dim)",
                            padding: "4px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            cursor: "pointer",
                            transition: "all 0.2s ease"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = "#fff"}
                        onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-dim)"}
                    >
                        Logout
                    </button>
                </div>
            </div>
            <div className="terminal-wrapper">
                <div ref={terminalRef} className="xterm-container" />
            </div>
        </div>
    );
}
