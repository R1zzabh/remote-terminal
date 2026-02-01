import { useEffect, useRef } from "react";
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

    useEffect(() => {
        if (!terminalRef.current) return;

        const term = new Terminal({
            cursorBlink: true,
            theme: {
                background: "#1e1e1e",
                foreground: "#f0f0f0",
            },
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(terminalRef.current);
        fitAddon.fit();
        termRef.current = term;

        // Connect WS - Port 3002
        const ws = new WebSocket("ws://localhost:3007/ws");
        wsRef.current = ws;

        ws.onopen = () => {
            term.write("\r\nConnected to server...\r\n");
            // Auth
            ws.send(JSON.stringify({ type: "auth", token }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "output") {
                    term.write(msg.data);
                } else if (msg.type === "authenticated") {
                    term.write("\r\nAuthenticated!\r\n");
                    // Enable input
                    term.onData(data => {
                        ws.send(JSON.stringify({ type: "input", data }));
                    });

                    // Handle resize
                    const handleResize = () => {
                        fitAddon.fit();
                        ws.send(JSON.stringify({
                            type: "resize",
                            cols: term.cols,
                            rows: term.rows
                        }));
                    };
                    window.addEventListener('resize', handleResize);
                    setTimeout(handleResize, 100);
                } else if (msg.type === "error") {
                    term.write(`\r\nError: ${msg.message}\r\n`);
                }
            } catch (e) {
                console.error(e);
            }
        };

        ws.onclose = () => {
            term.write("\r\nConnection closed.\r\n");
        };

        return () => {
            ws.close();
            term.dispose();
        };
    }, [token, onLogout]);

    return <div ref={terminalRef} style={{ width: "100%", height: "100vh", overflow: "hidden" }} />;
}
