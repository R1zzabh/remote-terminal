import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import "xterm/css/xterm.css";
import { CommandPalette } from "./CommandPalette";
import { Plus, X, Monitor, RefreshCw, LayoutTemplate } from "lucide-react";
import { clsx } from "clsx";
import { FileExplorer } from "./FileExplorer";
import { CodeEditor } from "./CodeEditor";

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

interface TerminalPane {
    id: string;
    term: Terminal;
    fitAddon: FitAddon;
    ws: WebSocket;
    status: "connecting" | "connected" | "disconnected" | "error";
}

interface TerminalSession {
    id: string; // Tab ID
    panes: TerminalPane[];
    layout: "single" | "horizontal" | "vertical";
}

export function TerminalComponent({ token, onLogout }: TerminalComponentProps) {
    const [sessions, setSessions] = useState<TerminalSession[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(localStorage.getItem('ryo_active_tab'));
    const paneContainersRef = useRef<Map<string, HTMLDivElement>>(new Map());

    const [isPaletteOpen, setIsPaletteOpen] = useState(false);
    const [theme, setTheme] = useState<keyof typeof THEMES>("dark");
    const [fontFamily, setFontFamily] = useState("'JetBrains Mono', 'Fira Code', monospace");
    const [showSidebar, setShowSidebar] = useState(true);
    const [editingFilePath, setEditingFilePath] = useState<string | null>(null);

    const activeSession = sessions.find(s => s.id === activeSessionId);

    // PERSISTENCE: Active Tab
    useEffect(() => {
        if (activeSessionId) localStorage.setItem('ryo_active_tab', activeSessionId);
    }, [activeSessionId]);

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
    }, [theme, fontFamily]);

    const createPane = useCallback((paneId: string, sshHost?: string): TerminalPane => {
        const { term, fitAddon } = createTerminalObject();
        const ws = new WebSocket(`ws://localhost:3001/ws?sessionId=${paneId}`);

        const pane: TerminalPane = {
            id: paneId, term, fitAddon, ws,
            status: "connecting"
        };

        ws.onopen = () => {
            setSessions(prev => prev.map(s => ({
                ...s,
                panes: s.panes.map(p => p.id === paneId ? { ...p, status: "connected" as const } : p)
            })));
            term.write(`\r\n\x1b[32m[SYSTEM]\x1b[0m ${sshHost ? `Connecting to ${sshHost}...` : 'Session Initialized'}\r\n`);
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

        ws.onclose = () => setSessions(prev => prev.map(s => ({
            ...s,
            panes: s.panes.map(p => p.id === paneId ? { ...p, status: "disconnected" as const } : p)
        })));

        ws.onerror = () => setSessions(prev => prev.map(s => ({
            ...s,
            panes: s.panes.map(p => p.id === paneId ? { ...p, status: "error" as const } : p)
        })));

        return pane;
    }, [token, createTerminalObject]);

    const restoreSessions = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3001/api/sessions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const existing = await res.json();

            if (existing.length > 0) {
                // Group existing backend sessions into tabs (For now, 1 session per tab)
                const restored = existing.map((s: any): TerminalSession => ({
                    id: Math.random().toString(36).substring(7),
                    panes: [createPane(s.id)],
                    layout: "single"
                }));
                setSessions(restored);
                if (!activeSessionId) setActiveSessionId(restored[0].id);
            } else {
                createNewTab();
            }
        } catch (e) {
            console.error("Failed to restore sessions", e);
            createNewTab();
        }
    }, [token, createPane, activeSessionId]);

    const createNewTab = useCallback((sshHost?: string) => {
        const tabId = Math.random().toString(36).substring(7);
        const paneId = Math.random().toString(36).substring(7);
        const newSession: TerminalSession = {
            id: tabId,
            panes: [createPane(paneId, sshHost)],
            layout: "single"
        };
        setSessions(prev => [...prev, newSession]);
        setActiveSessionId(tabId);
    }, [createPane]);

    const splitActiveTab = useCallback((type: 'horizontal' | 'vertical') => {
        if (!activeSession) return;

        const newPaneId = Math.random().toString(36).substring(7);
        const newPane = createPane(newPaneId);

        setSessions(prev => prev.map(s => s.id === activeSessionId ? {
            ...s,
            panes: [...s.panes, newPane],
            layout: type
        } : s));
    }, [activeSession, activeSessionId, createPane]);

    const closeTab = async (tabId: string) => {
        const session = sessions.find(s => s.id === tabId);
        if (session) {
            session.panes.forEach(p => {
                p.ws.close();
                p.term.dispose();
                fetch(`http://localhost:3001/api/sessions/${p.id}`, {
                    method: 'DELETE',
                    headers: { Authorization: `Bearer ${token}` }
                }).catch(console.error);
            });

            setSessions(prev => prev.filter(s => s.id !== tabId));
            if (activeSessionId === tabId) {
                const remaining = sessions.filter(s => s.id !== tabId);
                setActiveSessionId(remaining.length > 1 ? remaining[0].id : null);
            }
        }
    };

    useEffect(() => {
        restoreSessions();
    }, [restoreSessions]);

    useEffect(() => {
        sessions.forEach(session => {
            session.panes.forEach(pane => {
                const container = paneContainersRef.current.get(pane.id);
                if (container && !pane.term.element) {
                    pane.term.open(container);
                    pane.fitAddon.fit();
                    pane.term.focus();
                }
            });
        });
    }, [sessions, activeSessionId]);

    useEffect(() => {
        sessions.forEach(s => {
            s.panes.forEach(p => {
                p.term.options.theme = THEMES[theme];
                p.term.options.fontFamily = fontFamily;
                p.fitAddon.fit();
            });
        });
        document.documentElement.setAttribute('data-theme', theme);
    }, [theme, fontFamily, sessions]);

    const handleAction = (action: string, value?: string) => {
        if (action === 'logout') onLogout();
        else if (action === 'toggle-sidebar') setShowSidebar(prev => !prev);
        else if (action.startsWith('theme-')) setTheme(action.replace('theme-', '') as any);
        else if (action === 'clear') activeSession?.panes[0].term.clear();
        else if (action === 'status') restoreSessions();
        else if (action === 'ssh-connect' && value) createNewTab(value);
        else if (action === 'font-change' && value) setFontFamily(value);
        else if (action === 'split-horizontal') splitActiveTab('horizontal');
        else if (action === 'split-vertical') splitActiveTab('vertical');
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
                        <span>Tab {s.id}</span>
                        <X size={14} className="close-icon" onClick={(e) => { e.stopPropagation(); closeTab(s.id); }} />
                    </div>
                ))}
                <button onClick={() => createNewTab()} className="tab-action-btn" title="New Tab"><Plus size={18} /></button>
                <button onClick={() => splitActiveTab('vertical')} className="tab-action-btn" title="Split Vertical"><LayoutTemplate size={16} /></button>
                <button onClick={restoreSessions} className="tab-action-btn" title="Sync Sessions"><RefreshCw size={16} /></button>
                <div style={{ flex: 1 }} />
                <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer', padding: '0 12px' }}>Logout</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {showSidebar && <FileExplorer
                    token={token}
                    onSelectFolder={(path) => activeSession?.panes[0].ws.send(JSON.stringify({ type: "input", data: `cd "${path}"\r` }))}
                    onSelectFile={(path) => setEditingFilePath(path)}
                />}

                <div style={{ flex: 1, position: 'relative', display: 'flex' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: activeSession?.layout === 'vertical' ? 'row' : 'column' }}>
                        {activeSession?.panes.map((pane, index) => (
                            <div
                                key={pane.id}
                                ref={el => { if (el) paneContainersRef.current.set(pane.id, el); else paneContainersRef.current.delete(pane.id); }}
                                className="pane-wrapper"
                                style={{
                                    flex: 1, position: 'relative',
                                    borderLeft: index > 0 && activeSession.layout === 'vertical' ? '1px solid var(--glass-border)' : 'none',
                                    borderTop: index > 0 && activeSession.layout === 'horizontal' ? '1px solid var(--glass-border)' : 'none',
                                }}
                            >
                                {pane.status !== 'connected' && (
                                    <div style={{ position: 'absolute', top: 10, right: 20, zIndex: 10, fontSize: '10px', color: 'var(--accent-color)' }}>
                                        {pane.status.toUpperCase()}...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {editingFilePath && (
                        <div style={{ width: '40%', minWidth: '400px', borderLeft: '1px solid var(--glass-border)' }}>
                            <CodeEditor path={editingFilePath} token={token} onClose={() => setEditingFilePath(null)} />
                        </div>
                    )}
                </div>
            </div>

            <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onAction={handleAction} />
        </div>
    );
}
