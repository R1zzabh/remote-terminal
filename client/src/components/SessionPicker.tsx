import { useState, useEffect } from 'react';
import { Terminal, Users, Search, Plus, Monitor } from 'lucide-react';
import { clsx } from 'clsx';
import { decodeToken } from '../utils/auth';

interface Session {
    id: string;
    username: string;
    createdAt: string;
    clients: number;
    sshHost?: string;
    shareMode: "collaborative" | "view-only";
}

interface SessionPickerProps {
    token: string;
    onJoin: (sessionId: string) => void;
    onCreate: () => void;
    onClose: () => void;
}

export function SessionPicker({ token, onJoin, onCreate, onClose }: SessionPickerProps) {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        fetchSessions();
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

    const filteredSessions = sessions.filter(s =>
        s.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.id.includes(searchTerm) ||
        (s.sshHost && s.sshHost.toLowerCase().includes(searchTerm.toLowerCase()))
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

                <div className="picker-search">
                    <Search size={16} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search active sessions..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="sessions-list">
                    {loading ? (
                        <div className="loading-state">Loading active sessions...</div>
                    ) : filteredSessions.length === 0 ? (
                        <div className="empty-state">
                            <Monitor size={32} />
                            <p>No active sessions found.</p>
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
                    )}
                </div>
            </div>
        </div>
    );
}
