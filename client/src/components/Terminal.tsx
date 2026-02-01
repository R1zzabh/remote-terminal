import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import { WebLinksAddon } from "xterm-addon-web-links";
import { SearchAddon } from "xterm-addon-search";
import { WebglAddon } from "xterm-addon-webgl";
import { ImageAddon } from "xterm-addon-image";
import "xterm/css/xterm.css";
import { CommandPalette } from "./CommandPalette";
import { clsx } from "clsx";
import { CodeEditor } from "./CodeEditor";
import { ShortcutManager } from "./ShortcutManager";
import { TouchToolbar } from "./TouchToolbar";
import { decodeToken } from "../utils/auth";
import { Plus, X, Monitor, RefreshCw, LayoutTemplate, Search, Menu, Clock } from "lucide-react";
import { registerCorePlugins } from "../corePlugins";
import { pluginRegistry } from "../utils/pluginRegistry";
import { ErrorBoundary } from "./ErrorBoundary";
import { Suspense } from "react";

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
    const [sidebarView, setSidebarView] = useState('files');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [ctrlPressed, setCtrlPressed] = useState(false);
    const [altPressed, setAltPressed] = useState(false);
    const [touchStartX, setTouchStartX] = useState<number | null>(null);
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

    useEffect(() => {
        registerCorePlugins();
    }, []);

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

    const socketsRef = useRef<Map<string, WebSocket>>(new Map());

    const connectWebSocket = useCallback((paneId: string, term: Terminal, sshHost?: string, attempt = 0) => {
        const ws = new WebSocket(`ws://localhost:3001/ws?sessionId=${paneId}`);
        socketsRef.current.set(paneId, ws);

        const retry = () => {
            const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
            setTimeout(() => connectWebSocket(paneId, term, sshHost, attempt + 1), delay);
        };

        ws.onopen = () => {
            setSessions(prev => prev.map(s => s.panes.some(p => p.id === paneId)
                ? { ...s, panes: s.panes.map(p => p.id === paneId ? { ...p, status: "connected" } : p) }
                : s
            ));
            term.write(`\r\n\x1b[32m[SYSTEM]\x1b[0m ${sshHost ? `Connecting to ${sshHost}...` : 'Connected to Server'}\r\n`);
            ws.send(JSON.stringify({ type: "auth", token, sshHost }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === "output") term.write(msg.data);
                else if (msg.type === "authenticated") {
                    ws.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
                }
            } catch (e) { console.error(e); }
        };

        ws.onclose = (e) => {
            setSessions(prev => prev.map(s => s.panes.some(p => p.id === paneId)
                ? { ...s, panes: s.panes.map(p => p.id === paneId ? { ...p, status: "disconnected" } : p) }
                : s
            ));
            if (e.code !== 1000 && e.code !== 1001) {
                term.write(`\r\n\x1b[31m[SYSTEM] Connection lost. Reconnecting...\x1b[0m\r\n`);
                retry();
            }
        };

        ws.onerror = () => {
            setSessions(prev => prev.map(s => s.panes.some(p => p.id === paneId)
                ? { ...s, panes: s.panes.map(p => p.id === paneId ? { ...p, status: "error" } : p) }
                : s
            ));
        };

        return ws;
    }, [token]);

    const createPane = useCallback((paneId: string, sshHost?: string): TerminalPane => {
        const { term, fitAddon, searchAddon } = createTerminalObject();
        const pane: TerminalPane = { id: paneId, term, fitAddon, searchAddon, ws: null as any, status: "connecting" };

        connectWebSocket(paneId, term, sshHost);

        term.onData(data => {
            const ws = socketsRef.current.get(paneId);
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "input", data }));
            }
        });

        term.onResize(size => {
            const ws = socketsRef.current.get(paneId);
            if (ws?.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "resize", cols: size.cols, rows: size.rows }));
            }
        });

        term.onBell(() => {
            const tab = document.getElementById(`tab-indicator-${paneId}`);
            if (tab) {
                tab.style.animation = 'bell-shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
                setTimeout(() => tab.style.animation = '', 500);
            }
        });

        return pane;
    }, [createTerminalObject, connectWebSocket]);

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
                const savedActiveId = localStorage.getItem('ryo_active_tab');
                if (savedActiveId && restored.some(s => s.id === savedActiveId)) {
                    setActiveSessionId(savedActiveId);
                } else {
                    setActiveSessionId(restored[0].id);
                }
            } else {
                createNewTab();
            }
        } catch (e) {
            console.error("Failed to restore sessions", e);
            createNewTab();
        }
    }, [token, createPane, createNewTab]);

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
        let mounted = true;
        if (mounted) restoreSessions();
        return () => { mounted = false; };
    }, []); // Only run once on mount

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
        else if (action === 'theme-builder') setSidebarView('theme');
        else if (action === 'macro-manager') setSidebarView('macros');
        else if (action === 'search-history') {
            setShowHistory(true);
            fetchHistory("");
        }
        else if (action === 'view-logs') setEditingFilePath('/home/ridgehub/shobha/server/logs/access.log');
    };

    return (
        <div
            className="terminal-page"
            style={{ height: "100vh", display: "flex", flexDirection: "column", background: "#050505", overflow: 'hidden' }}
            onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
            onTouchEnd={(e) => {
                if (touchStartX === null) return;
                const touchEndX = e.changedTouches[0].clientX;
                const deltaX = touchEndX - touchStartX;
                if (deltaX > 100) setIsMobileMenuOpen(true); // Swipe Right
                else if (deltaX < -100) setIsMobileMenuOpen(false); // Swipe Left
                setTouchStartX(null);
            }}
        >
            {/* Header / Tab Bar */}
            <div className="terminal-header" style={{
                height: 'var(--header-height)',
                display: 'flex',
                alignItems: 'center',
                background: 'var(--bg-secondary)',
                borderBottom: '1px solid var(--glass-border)',
                zIndex: 1001,
                padding: '0 12px',
                gap: '8px'
            }}>
                <div className="show-mobile" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                    <Menu size={20} className="text-accent cursor-pointer" />
                </div>
                <div className="hidden-mobile" style={{
                    fontSize: '13px',
                    fontWeight: 'bold',
                    color: 'var(--accent-color)',
                    letterSpacing: '1px',
                    marginRight: '12px'
                }}>RYO</div>

                <div className="tab-container" style={{ display: 'flex', gap: '4px', overflowX: 'auto', flex: 1, padding: '4px 0' }}>
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
                                transition: 'all 0.2s ease',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            <Monitor size={14} />
                            <span>Tab {s.id}</span>
                            <X size={14} className="close-icon" onClick={(e) => { e.stopPropagation(); closeTab(s.id); }} />
                        </div>
                    ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <button onClick={() => createNewTab()} className="tab-action-btn" title="New Tab"><Plus size={18} /></button>
                    <button onClick={() => splitActiveTab('vertical')} className="tab-action-btn" title="Split Vertical"><LayoutTemplate size={16} /></button>
                    <button onClick={() => restoreSessions()} className="tab-action-btn" title="Sync Sessions"><RefreshCw size={16} /></button>
                    <div style={{ width: '1px', height: '24px', background: 'var(--glass-border)', margin: '0 8px' }} />
                    <button onClick={onLogout} style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: '11px', cursor: 'pointer' }}>Logout</button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="terminal-main" style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
                {/* Sidebar Overlay for Mobile */}
                {isMobileMenuOpen && (
                    <div
                        className="show-mobile"
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )}

                {/* Sidebar */}
                <div className={clsx("sidebar-root", isMobileMenuOpen ? "mobile-drawer open" : "mobile-drawer", !showSidebar && "hidden")}
                    style={{
                        display: showSidebar ? 'flex' : 'none',
                        borderRight: '1px solid var(--glass-border)',
                        background: 'var(--glass-bg)',
                        backdropFilter: 'blur(20px)',
                        width: isMobileMenuOpen ? '85%' : 'var(--sidebar-width)',
                        maxWidth: '320px',
                        flexShrink: 0
                    }}>
                    <div style={{ width: '56px', background: 'rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: '24px', borderRight: '1px solid var(--glass-border)', flexShrink: 0 }}>
                        {useMemo(() => pluginRegistry.getPlugins(decodeToken(token)?.role), [token]).map((p: any) => (
                            <p.icon
                                key={p.id}
                                size={20}
                                className={clsx("cursor-pointer transition-colors", sidebarView === p.id ? "text-accent" : "text-dim")}
                                onClick={() => setSidebarView(p.id)}
                            />
                        ))}
                    </div>
                    <div className="sidebar-content" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        {(() => {
                            const activePlugin = pluginRegistry.getPlugin(sidebarView) || pluginRegistry.getPlugin('files');
                            if (!activePlugin) return null;
                            const Component = activePlugin.component;
                            return (
                                <ErrorBoundary key={activePlugin.id}>
                                    <Suspense fallback={<div className="p-4 text-dim text-xs">Loading {activePlugin.name}...</div>}>
                                        <div style={{ flex: 1, overflowY: 'auto' }}>
                                            <Component
                                                token={token}
                                                theme={theme}
                                                onClose={() => setSidebarView('files')}
                                                onSelectFolder={(path: string) => activeSession?.panes[0].ws.send(JSON.stringify({ type: "input", data: `cd "${path}"\r` }))}
                                                onSelectFile={(path: string) => setEditingFilePath(path)}
                                                onSelectCommand={(cmd: string) => activeSession?.panes[0].ws.send(JSON.stringify({ type: "input", data: `${cmd}\r` }))}
                                            />
                                        </div>
                                    </Suspense>
                                </ErrorBoundary>
                            );
                        })()}
                    </div>
                </div>

                {/* Terminal Pane Container */}
                <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', background: '#050505', overflow: 'hidden' }}>
                    <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: activeSession?.layout === 'vertical' ? 'row' : 'column', overflow: 'hidden' }}>
                        {activeSession?.panes.map((pane, index) => (
                            <div
                                key={pane.id}
                                ref={el => { if (el) paneContainersRef.current.set(pane.id, el); else paneContainersRef.current.delete(pane.id); }}
                                className="pane-wrapper"
                                style={{
                                    flex: 1, position: 'relative',
                                    borderLeft: index > 0 && activeSession.layout === 'vertical' ? '1px solid var(--glass-border)' : 'none',
                                    borderTop: index > 0 && activeSession.layout === 'horizontal' ? '1px solid var(--glass-border)' : 'none',
                                    overflow: 'hidden'
                                }}
                            >
                                {pane.status !== 'connected' && (
                                    <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 10, fontSize: '10px', color: 'var(--accent-color)', background: 'rgba(0,0,0,0.5)', padding: '2px 6px', borderRadius: '4px' }}>
                                        {pane.status.toUpperCase()}...
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    <TouchToolbar
                        onKeyPress={(key) => {
                            if (key === 'ctrl') setCtrlPressed(!ctrlPressed);
                            else if (key === 'alt') setAltPressed(!altPressed);
                            else {
                                if (!activeSession) return;
                                let data = key;
                                if (ctrlPressed) {
                                    const code = key.toUpperCase().charCodeAt(0);
                                    if (code >= 65 && code <= 90) data = String.fromCharCode(code - 64);
                                }
                                activeSession.panes[0].ws.send(JSON.stringify({ type: "input", data }));
                                if (ctrlPressed) setCtrlPressed(false);
                                if (altPressed) setAltPressed(false);
                            }
                        }}
                    />

                    {editingFilePath && (
                        <div className="editor-pane" style={{
                            position: 'absolute',
                            right: 0, top: 0, bottom: 0,
                            width: '50%',
                            background: 'var(--bg-secondary)',
                            zIndex: 100,
                            borderLeft: '1px solid var(--glass-border)',
                            boxShadow: '-4px 0 24px rgba(0,0,0,0.5)'
                        }}>
                            <CodeEditor path={editingFilePath} token={token} theme={theme} onClose={() => setEditingFilePath(null)} />
                        </div>
                    )}

                    {showSearch && (
                        <div style={{ position: 'absolute', top: 12, right: 12, zIndex: 100, background: 'var(--glass-bg)', backdropFilter: 'blur(20px)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: 'var(--glass-shadow)' }}>
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
                            <X size={14} className="cursor-pointer text-dim hover:text-white transition-colors" onClick={() => setShowSearch(false)} />
                        </div>
                    )}

                    {showHistory && (
                        <div style={{ position: 'absolute', top: '10vh', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, width: '90%', maxWidth: '500px', background: 'var(--glass-bg)', backdropFilter: 'blur(30px)', border: '1px solid var(--glass-border)', borderRadius: '16px', boxShadow: 'var(--glass-shadow)', overflow: 'hidden' }}>
                            <div style={{ padding: '16px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Clock size={16} className="text-accent" />
                                <input
                                    autoFocus
                                    placeholder="Search command history..."
                                    style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none', fontSize: '15px' }}
                                    onChange={e => fetchHistory(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Escape') setShowHistory(false); }}
                                />
                                <X size={16} className="cursor-pointer text-dim hover:text-white" onClick={() => setShowHistory(false)} />
                            </div>
                            <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '8px' }}>
                                {historyResults.map((line, i) => (
                                    <div
                                        key={i}
                                        onClick={() => { activeSession?.panes[0].ws.send(JSON.stringify({ type: "input", data: line + "\r" })); setShowHistory(false); }}
                                        style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', color: '#ccc', transition: 'background 0.2s' }}
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
        </div >
    );
}
