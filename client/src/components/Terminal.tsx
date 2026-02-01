import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { CommandPalette } from "./CommandPalette";
import { Plus, X, Monitor, RefreshCw } from "lucide-react";
import { clsx } from "clsx";
import { FileExplorer } from "./FileExplorer";

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
    initialised: boolean;
}

export function TerminalComponent({ token, onLogout }: TerminalComponentProps) {
    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
    const terminalContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());

    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [theme, setTheme] = useState<keyof typeof THEMES>("dark");
    const [fontFamily, setFontFamily] = useState("'JetBrains Mono', 'Fira Code', monospace");
    const [showSidebar, setShowSidebar] = useState(true);

    const activeSession = sessions.find(s => s.id === activeSessionId);

    const createTerminalObject = useCallback(() => {
        const term = new Terminal({
            cursorBlink: true,
            theme: THEMES[theme],
            fontFamily: fontFamily,
            fontSize: 14,
            allowProposedApi: true
        });
        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        return { term, fitAddon };
    }, [theme]);

    const attachSession = useCallback((id: string, sshHost?: string) => {
        const { term, fitAddon } = createTerminalObject();
        const ws = new WebSocket(`ws://localhost:3001/ws?sessionId=${id}`);

        const session: TerminalSession = {
            id, term, fitAddon, ws,
            status: "connecting",
            initialised: false
        };

        ws.onopen = () => {
            setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "connected" } : s));
            term.write(`\r\n\x1b[32m[SYSTEM]\x1b[0m ${sshHost ? `Connecting to ${sshHost}...` : 'Session Restored'}\r\n`);
            ws.send(JSON.stringify({ type: "auth", token, sshHost }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "output") {
                    term.write(msg.data);
                } else if (msg.type === "authenticated") {
                    term.onData(data => {
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ type: "input", data }));
                        }
                    });
                    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
                }
            } catch (e) { console.error(e); }
        };

        ws.onclose = () => setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "disconnected" } : s));
        ws.onerror = () => setSessions(prev => prev.map(s => s.id === id ? { ...s, status: "error" } : s));

        return session;
    }, [token, createTerminalObject]);

    const restoreSessions = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3001/api/sessions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const existing = await res.json();

            if (existing.length > 0) {
                const restored = existing.map((s: any) => attachSession(s.id));
                setSessions(restored);
                setActiveSessionId(restored[0].id);
            } else {
                createNewSession();
            }
        } catch (e) {
            console.error("Failed to restore sessions", e);
            createNewSession();
        }
    }, [token, attachSession]);

    const createNewSession = useCallback((sshHost?: string) => {
        const id = Math.random().toString(36).substring(7);
        const session = attachSession(id, sshHost);
        setSessions(prev => [...prev, session]);
        setActiveSessionId(id);
    }, [attachSession]);

    const closeSession = async (id: string) => {
        const session = sessions.find(s => s.id === id);
        if (session) {
            session.ws.close();
            session.term.dispose();
            setSessions(prev => prev.filter(s => s.id !== id));

            // Clean up on backend
            fetch(`http://localhost:3001/api/sessions/${id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            }).catch(console.error);

            if (activeSessionId === id) {
                const remaining = sessions.filter(s => s.id !== id);
                setActiveSessionId(remaining.length > 1 ? remaining[0].id : null);
            }
        }
    };

    useEffect(() => {
        restoreSessions();
    }, [restoreSessions]);

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
            s.term.options.fontFamily = fontFamily;
            s.fitAddon.fit();
        });
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme, fontFamily, sessions]);

    const handleAction = (action: string, value?: string) => {
        if (action === 'logout') onLogout();
        else if (action === 'toggle-sidebar') setShowSidebar(prev => !prev);
        else if (action.startsWith('theme-')) setTheme(action.replace('theme-', '') as any);
        else if (action === 'clear') activeSession?.term.clear();
        else if (action === 'status') restoreSessions();
        else if (action === 'ssh-connect' && value) createNewSession(value);
        else if (action === 'font-change' && value) setFontFamily(value);
    };

    return (
        <div className="terminal-page" style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#050505" }}>
            <div className="tab-bar" style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)', padding: '4px 8px', gap: '4px', alignItems: 'center' }}>
                <div style={{ padding: '0 12px', fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-color)', letterSpacing: '1px' }}>RYO</div>
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
                        <span>{s.id}</span>
                        <X size={14} className="close-icon" onClick={(e) => { e.stopPropagation(); closeSession(s.id); }} />
                    </div>
                ))}
                <button onClick={() => createNewSession()} className="tab-action-btn" title="New Session">
                    <Plus size={18} />
                </button>
                <button onClick={restoreSessions} className="tab-action-btn" title="Sync Sessions">
                    <RefreshCw size={16} />
                </button>
                <div style={{ flex: 1 }} />
                <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer', padding: '0 12px' }}>Logout</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {showSidebar && <FileExplorer token={token} onSelectFolder={(path) => {
                    activeSession?.ws.send(JSON.stringify({ type: "input", data: `cd "${path}"\r` }));
                }} />}

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
                            {s.status !== 'connected' && (
                                <div style={{ position: 'absolute', top: 10, right: 20, zIndex: 10, fontSize: '10px', color: 'var(--accent-color)' }}>
                                    {s.status.toUpperCase()}...
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onAction={handleAction} />
        </div>
    );
}
