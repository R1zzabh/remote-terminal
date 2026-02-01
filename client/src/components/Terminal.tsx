import { useState, useEffect, useRef, useCallback } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { SearchAddon } from "xterm-addon-search";
import { WebglAddon } from "xterm-addon-webgl";
import { ImageAddon } from "xterm-addon-image";
import "xterm/css/xterm.css";
import { CommandPalette } from "./CommandPalette";
import { Dashboard } from "./Dashboard";
import { Plus, X, Monitor, RefreshCw, LayoutTemplate, Search, Files, Activity, Clock } from "lucide-react";
import { clsx } from "clsx";
import { FileExplorer } from "./FileExplorer";
import { CodeEditor } from "./CodeEditor";
import { ShortcutManager } from "./ShortcutManager";

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
    searchAddon: SearchAddon;
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
    const [sidebarView, setSidebarView] = useState<'files' | 'system'>('files');
    const [editingFilePath, setEditingFilePath] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [showSearch, setShowSearch] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyResults, setHistoryResults] = useState<string[]>([]);

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
            allowProposedApi: true,
            scrollback: 10000,
            drawBoldTextInBrightColors: true,
            fastScrollModifier: "alt",
            screenReaderMode: false
        });
        const fitAddon = new FitAddon();
        const searchAddon = new SearchAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());
        term.loadAddon(searchAddon);

        // WebGL acceleration
        try {
            const webgl = new WebglAddon();
            term.loadAddon(webgl);
        } catch (e) {
            console.warn("WebGL addon could not be loaded", e);
        }

        // Image Support
        try {
            const imageAddon = new ImageAddon();
            term.loadAddon(imageAddon);
        } catch (e) {
            console.warn("Image addon failed to load", e);
        }

        return { term, fitAddon, searchAddon };
    }, [theme, fontFamily]);

    const createPane = useCallback((paneId: string, sshHost?: string): TerminalPane => {
        const { term, fitAddon, searchAddon } = createTerminalObject();
        const ws = new WebSocket(`ws://localhost:3001/ws?sessionId=${paneId}`);

        const pane: TerminalPane = {
            id: paneId, term, fitAddon, searchAddon, ws,
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
                    term.onResize(size => ws.send(JSON.stringify({ type: "resize", cols: size.cols, rows: size.rows })));

                    term.onBell(() => {
                        const sess = sessions.find(s => s.panes.some(p => p.id === paneId));
                        if (sess) {
                            const tab = document.getElementById(`tab-${sess.id}`);
                            if (tab) {
                                tab.style.animation = 'bell-shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
                                tab.style.borderColor = 'var(--accent-color)';
                                setTimeout(() => {
                                    tab.style.animation = '';
                                    tab.style.borderColor = activeSessionId === sess.id ? 'var(--glass-border)' : 'transparent';
                                }, 500);
                            }
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
    }, [token, createTerminalObject, sessions, activeSessionId]);

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

    const restoreSessions = useCallback(async () => {
        try {
            const res = await fetch("http://localhost:3001/api/sessions", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const existing = await res.json();

            if (existing.length > 0) {
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
    }, [token, createPane, activeSessionId, createNewTab]);

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
                setActiveSessionId(remaining.length > 0 ? remaining[0].id : null);
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

    const fetchHistory = async (q: string) => {
        const res = await fetch(`http://localhost:3001/api/history?q=${encodeURIComponent(q)}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        setHistoryResults(data);
    };

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
        else if (action === 'new-tab') createNewTab();
        else if (action === 'close-tab') activeSessionId && closeTab(activeSessionId);
        else if (action === 'palette') setIsPaletteOpen(true);
        else if (action === 'search') setShowSearch(prev => !prev);
        else if (action === 'search-history') {
            setShowHistory(true);
            fetchHistory("");
        }
        else if (action === 'view-logs') setEditingFilePath('/home/ridgehub/shobha/server/logs/access.log');
    };

    return (
        <div className="terminal-page" style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#050505" }}>
            <div className="tab-bar" style={{ display: 'flex', background: 'rgba(255,255,255,0.03)', borderBottom: '1px solid var(--glass-border)', padding: '4px 8px', gap: '4px', alignItems: 'center' }}>
                <div style={{ padding: '0 12px', fontSize: '13px', fontWeight: 'bold', color: 'var(--accent-color)', letterSpacing: '1px' }}>RYO</div>
                {sessions.map(s => (
                    <div
                        key={s.id}
                        id={`tab-${s.id}`}
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
                <button onClick={() => restoreSessions()} className="tab-action-btn" title="Sync Sessions"><RefreshCw size={16} /></button>
                <div style={{ flex: 1 }} />
                <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer', padding: '0 12px' }}>Logout</button>
            </div>

            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                {showSidebar && (
                    <div style={{ display: 'flex', borderRight: '1px solid var(--glass-border)' }}>
                        <div style={{ width: '48px', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '12px 0', gap: '20px', borderRight: '1px solid var(--glass-border)' }}>
                            <Files size={20} className={clsx("cursor-pointer", sidebarView === 'files' ? "text-accent" : "text-dim")} onClick={() => setSidebarView('files')} />
                            <Activity size={20} className={clsx("cursor-pointer", sidebarView === 'system' ? "text-accent" : "text-dim")} onClick={() => setSidebarView('system')} />
                        </div>
                        {sidebarView === 'files' ? (
                            <FileExplorer
                                token={token}
                                onSelectFolder={(path) => activeSession?.panes[0].ws.send(JSON.stringify({ type: "input", data: `cd "${path}"\r` }))}
                                onSelectFile={(path) => setEditingFilePath(path)}
                            />
                        ) : (
                            <Dashboard token={token} />
                        )}
                    </div>
                )}

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
                            <CodeEditor path={editingFilePath} token={token} theme={theme} onClose={() => setEditingFilePath(null)} />
                        </div>
                    )}

                    {showSearch && (
                        <div style={{ position: 'absolute', top: 10, right: 20, zIndex: 100, background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Search size={14} className="text-dim" />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Find..."
                                value={searchTerm}
                                onChange={e => { setSearchTerm(e.target.value); activeSession?.panes[0].searchAddon.findNext(e.target.value); }}
                                onKeyDown={e => { if (e.key === 'Enter') activeSession?.panes[0].searchAddon.findNext(searchTerm); if (e.key === 'Escape') setShowSearch(false); }}
                                style={{ background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '13px' }}
                            />
                            <X size={14} className="cursor-pointer text-dim" onClick={() => setShowSearch(false)} />
                        </div>
                    )}

                    {showHistory && (
                        <div style={{ position: 'absolute', top: '15vh', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '500px', background: 'var(--glass-bg)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)', borderRadius: '16px', boxShadow: 'var(--glass-shadow)', overflow: 'hidden' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Clock size={16} className="text-accent" />
                                <input
                                    autoFocus
                                    placeholder="Search command history..."
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '15px' }}
                                    onChange={e => fetchHistory(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') setShowHistory(false); }}
                                />
                                <X size={16} className="cursor-pointer text-dim" onClick={() => setShowHistory(false)} />
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                                {historyResults.map((line, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { activeSession?.panes[0].ws.send(JSON.stringify({ type: "input", data: line + "\r" })); setShowHistory(false); }}
                                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#ccc' }}
                                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
                                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <code style={{ color: 'var(--accent-color)', marginRight: '8px' }}>$</code>
                                        {line}
                                    </div>
                                ))}
                                {historyResults.length === 0 && <div className="p-4 text-center text-dim text-xs">No history found</div>}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <ShortcutManager onAction={handleAction} />
            <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} onAction={handleAction} />
        </div>
    );
}
