import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Save, X, Maximize2, Minimize2 } from 'lucide-react';

interface CodeEditorProps {
    path: string;
    token: string;
    theme: string;
    onClose: () => void;
}

export function CodeEditor({ path, token, theme, onClose }: CodeEditorProps) {
    const [content, setContent] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);

    useEffect(() => {
        const fetchContent = async () => {
            setLoading(true);
            try {
                const res = await fetch(`http://localhost:3001/api/files/content?path=${encodeURIComponent(path)}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                setContent(data.content || "");
            } catch (e) {
                console.error("Failed to load file content", e);
            } finally {
                setLoading(false);
            }
        };
        fetchContent();
    }, [path, token]);

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch(`http://localhost:3001/api/files/content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ path, content })
            });
        } catch (e) {
            console.error("Failed to save file", e);
        } finally {
            setSaving(false);
        }
    };

    // Shortcut: Ctrl+S / Cmd+S
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [content, path, token]); // Re-bind when deps change to ensure closure has latest content

    const getLanguage = () => {
        const ext = path.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js': return 'javascript';
            case 'ts': case 'tsx': return 'typescript';
            case 'css': return 'css';
            case 'html': return 'html';
            case 'json': return 'json';
            case 'md': return 'markdown';
            case 'py': return 'python';
            case 'sh': return 'shell';
            case 'yml': case 'yaml': return 'yaml';
            default: return 'plaintext';
        }
    };

    const getMonacoTheme = () => {
        switch (theme) {
            case 'matrix': return 'hc-black';
            case 'nord': return 'vs-dark'; // Could use a custom nord theme later
            case 'solarized': return 'vs-dark';
            default: return 'vs-dark';
        }
    };

    if (loading) return (
        <div className="p-8 text-center text-dim bg-[#1e1e1e] h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
                <span>Loading {path}...</span>
            </div>
        </div>
    );

    return (
        <div className={`code-editor-container ${isMaximized ? 'maximized' : ''}`} style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: '#1e1e1e', borderLeft: '1px solid var(--glass-border)'
        }}>
            <div className="editor-toolbar" style={{
                padding: '8px 16px', borderBottom: '1px solid #333',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#252525'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{path}</span>
                    {saving && <span style={{ fontSize: '10px', color: 'var(--accent-color)', animation: 'pulse 1s infinite' }}>Saving...</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleSave} className="tool-btn" title="Save (Ctrl+S)" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <Save size={16} />
                    </button>
                    <button onClick={() => setIsMaximized(!isMaximized)} className="tool-btn" style={{ background: 'transparent', border: 'none', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={onClose} className="tool-btn" style={{ background: 'transparent', border: 'none', color: '#ff5555', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                        <X size={16} />
                    </button>
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <Editor
                    height="100%"
                    language={getLanguage()}
                    theme={getMonacoTheme()}
                    value={content}
                    onChange={(value) => setContent(value || "")}
                    options={{
                        fontSize: 14,
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 2,
                        wordWrap: 'on',
                        lineNumbers: 'on',
                        renderWhitespace: 'selection',
                        fontFamily: "'Fira Code', 'Monaco', 'Consolas', monospace",
                        fontLigatures: true,
                        cursorBlinking: 'smooth',
                        smoothScrolling: true,
                        padding: { top: 10 }
                    }}
                />
            </div>
        </div>
    );
}
