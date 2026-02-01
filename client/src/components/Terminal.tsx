import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { CommandPalette } from "./CommandPalette";
import { Plus, X, Monitor } from "lucide-react";
import { clsx } from "clsx";

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

interface TerminalSession {
    id: string;
    term: Terminal;
    fitAddon: FitAddon;
    ws: WebSocket;
    status: "connecting" | "connected" | "disconnected" | "error";
}

export function TerminalComponent({ token, onLogout }: TerminalComponentProps) {
    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const terminalContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());

    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [theme, setTheme] = useState<keyof typeof THEMES>("dark");

    const activeSession = sessions.find(s => s.id === activeSessionId);

    const createNewSession = useCallback(() => {
        const id = Math.random().toString(36).substring(7);

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

        const ws = new WebSocket(`ws://localhost:3001/ws?sessionId=${id}`);

        const newSession: TerminalSession = {
            id,
            term,
            fitAddon,
            ws,
            status: "connecting"
        };

        ws.onopen = () => {
            updateSessionStatus(id, "connected");
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
                    term.onData(data => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "input", data }));
                        }
                    });
                    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
                }
            } catch (e) { console.error(e); }
        };

        ws.onclose = () => updateSessionStatus(id, "disconnected");
        ws.onerror = () => updateSessionStatus(id, "error");

        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(id);
    }, [token, theme]);

    const updateSessionStatus = (id: string, status: TerminalSession["status"]) => {
        setSessions(prev => prev.map(s => s.id === id ? { ...s, status } : s));
    };

    const closeSession = (id: string) => {
        const session = sessions.find(s => s.id === id);
        if (session) {
            session.ws.close();
            session.term.dispose();
            setSessions(prev => prev.filter(s => s.id !== id));
            if (activeSessionId === id) {
                const remaining = sessions.filter(s => s.id !== id);
                setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
            }
        }
    };

    useEffect(() => {
        if (sessions.length === 0) {
            createNewSession();
        }
    }, [createNewSession, sessions.length]);

    useEffect(() => {
        sessions.forEach(session => {
            const container = terminalContainersRef.current.get(session.id);
            if (container && !session.term.element) {
                session.term.open(container);
                session.fitAddon.fit();
                session.term.focus();
            }
        });
    }, [sessions, activeSessionId]);

    useEffect(() => {
        sessions.forEach(s => {
            s.term.options.theme = THEMES[theme];
        });
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme, sessions]);

    return (
        <div className="terminal-page" style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#050505" }}>
            {/* Tab Bar */}
            <div className="tab-bar" style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)', padding: '4px 8px', gap: '4px' }}>
                {sessions.map(s => (
                    <div
                        key={s.id}
                        className={clsx("tab-item", s.id === activeSessionId && "active")}
                        onClick={() => setActiveSessionId(s.id)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px',
                            borderRadius: '6px', fontSize: '12px', cursor: 'pointer',
                            background: s.id === activeSessionId ? 'rgba(255,255,255,0.1)' : 'transparent',
                            color: s.id === activeSessionId ? '#fff' : 'var(--text-dim)',
                            border: '1px solid',
                            borderColor: s.id === activeSessionId ? 'var(--glass-border)' : 'transparent',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Monitor size={14} />
                        <span>Session {s.id}</span>
                        <X size={14} className="close-icon" onClick={(e) => { e.stopPropagation(); closeSession(s.id); }} />
                    </div>
                ))}
                <button
                    onClick={createNewSession}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '0 8px' }}
                >
                    <Plus size={18} />
                </button>
            </div>

            {/* Main Terminal Area */}
            <div style={{ flex: 1, position: 'relative' }}>
                {sessions.map(s => (
                    <div
                        key={s.id}
                        ref={el => { if (el) terminalContainersRef.current.set(s.id, el); else terminalContainersRef.current.delete(s.id); }}
                        className="terminal-wrapper"
                        style={{
                            position: 'absolute', inset: 0,
                            visibility: s.id === activeSessionId ? 'visible' : 'hidden',
                            zIndex: s.id === activeSessionId ? 1 : 0
                        }}
                    >
                        {/* Status Overlay */}
                        {s.status !== 'connected' && (
                            <div style={{ position: 'absolute', top: 10, right: 20, zIndex: 10, fontSize: '10px', color: 'var(--accent-color)' }}>
                                {s.status.toUpperCase()}...
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <CommandPalette
                isOpen={isPaletteOpen}
                onClose={() => setIsPaletteOpen(false)}
                onAction={(action) => {
                    if (action === 'logout') onLogout();
                    else if (action.startsWith('theme-')) setTheme(action.replace('theme-', '') as any);
                    else if (action === 'clear') activeSession?.term.clear();
                }}
            />
        </div>
    );
}
