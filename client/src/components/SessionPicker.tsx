import { useState, useEffect } from 'react';
import { Terminal, Users, Search, Plus, Monitor, Server, Laptop } from 'lucide-react';
import { decodeToken } from '../utils/auth';

interface Session {
    id: string;
    username: string;
    createdAt: string;
    clients: number;
    sshHost?: string;
    shareMode: "collaborative" | "view-only";
}

interface HostSession {
    name: string;
    windows: number;
    attached: boolean;
}

interface SessionPickerProps {
    token: string;
    onJoin: (sessionId: string) => void;
    onAttachHost: (tmuxName: string) => void;
    onCreate: () => void;
    onClose: () => void;
}

export function SessionPicker({ token, onJoin, onAttachHost, onCreate, onClose }: SessionPickerProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [hostSessions, setHostSessions] = useState<HostSession[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState<'ryo' | 'host'>('host');

    useEffect(() => {
        fetchSessions();
        fetchHostSessions();
    }, []);

    const fetchSessions = async () => {
        try {
            const hostname = window.location.hostname;
            const res = await fetch(`http://${hostname}:3001/api/sessions/shared`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setSessions(data);
        } catch (error) {
            console.error("Failed to fetch sessions", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchHostSessions = async () => {
        // Use WebSocket to get host sessions via tmux command
        const hostname = window.location.hostname;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${hostname}:3001/ws`);
        ws.onopen = () => {
            ws.send(JSON.stringify({ type: 'auth', token }));
        };
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            if (msg.type === 'authenticated') {
                ws.send(JSON.stringify({ type: 'list-host-sessions' }));
            } else if (msg.type === 'host-sessions-list') {
                setHostSessions(msg.sessions || []);
                ws.close();
            }
        };
    };

    const filteredSessions = sessions.filter(s =>
        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.includes(searchTerm) ||
        (s.sshHost && s.sshHost.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const filteredHostSessions = hostSessions.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const currentUser = decodeToken(token)?.username;

    return (
        <div className="session-picker-overlay" onClick={onClose}>
            <div className="session-picker-modal" onClick={e => e.stopPropagation()}>
                <div className="picker-header">
                    <h2>Terminal Sessions</h2>
                    <div className="picker-actions">
                        <button className="create-btn" onClick={onCreate}>
                            <Plus size={16} />
                            <span>New Session</span>
                        </button>
                    </div>
                </div>

                {/* Tab Switcher */}
                <div className="picker-tabs">
                    <button
                        className={`picker-tab ${activeTab === 'host' ? 'active' : ''}`}
                        onClick={() => setActiveTab('host')}
                    >
                        <Laptop size={14} />
                        Host Sessions
                    </button>
                    <button
                        className={`picker-tab ${activeTab === 'ryo' ? 'active' : ''}`}
                        onClick={() => setActiveTab('ryo')}
                    >
                        <Server size={14} />
                        Ryo Sessions
                    </button>
                </div>

                <div className="picker-search">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder={activeTab === 'host' ? "Search tmux sessions..." : "Search active sessions..."}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="sessions-list">
                    {loading ? (
                        <div className="loading-state">Loading sessions...</div>
                    ) : activeTab === 'host' ? (
                        /* HOST SESSIONS TAB */
                        filteredHostSessions.length === 0 ? (
                            <div className="empty-state">
                                <Laptop size={32} />
                                <p>No tmux sessions found on host.</p>
                                <span style={{ fontSize: '12px', color: '#666' }}>Start a tmux session with: tmux new -s mywork</span>
                            </div>
                        ) : (
                            filteredHostSessions.map(session => (
                                <div key={session.name} className="session-item" onClick={() => onAttachHost(session.name)}>
                                    <div className="session-icon host">
                                        <Laptop size={20} />
                                    </div>
                                    <div className="session-info">
                                        <div className="session-title">
                                            <span className="owner">{session.name}</span>
                                            {session.attached && <span className="attached-badge">ATTACHED</span>}
                                        </div>
                                        <div className="session-meta">
                                            <span>{session.windows} window{session.windows !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )
                    ) : (
                        /* RYO SESSIONS TAB */
                        filteredSessions.length === 0 ? (
                            <div className="empty-state">
                                <Monitor size={32} />
                                <p>No active Ryo sessions.</p>
                                <button onClick={onCreate}>Start a new one</button>
                            </div>
                        ) : (
                            filteredSessions.map(session => (
                                <div key={session.id} className="session-item" onClick={() => onJoin(session.id)}>
                                    <div className="session-icon">
                                        <Terminal size={20} />
                                    </div>
                                    <div className="session-info">
                                        <div className="session-title">
                                            <span className="owner">{session.username}</span>
                                            {session.sshHost && <span className="ssh-badge">SSH: {session.sshHost}</span>}
                                            {currentUser === session.username && <span className="you-badge">YOU</span>}
                                        </div>
                                        <div className="session-meta">
                                            <span className="id">#{session.id.substring(0, 8)}</span>
                                            <span className="dot">•</span>
                                            <span className="mode">{session.shareMode}</span>
                                            <span className="dot">•</span>
                                            <span className="time">{new Date(session.createdAt).toLocaleTimeString()}</span>
                                        </div>
                                    </div>
                                    <div className="session-users">
                                        <Users size={14} />
                                        <span>{session.clients}</span>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>
        </div>
    );
}
