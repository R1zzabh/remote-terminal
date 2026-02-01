import { useState, useEffect } from 'react';
import AceEditor from 'react-ace';
import { Save, X, Maximize2, Minimize2 } from 'lucide-react';

import "ace-builds/src-noconflict/mode-javascript";
import "ace-builds/src-noconflict/mode-typescript";
import "ace-builds/src-noconflict/mode-css";
import "ace-builds/src-noconflict/mode-html";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/mode-markdown";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/theme-terminal";
import "ace-builds/src-noconflict/theme-nord_dark";
import "ace-builds/src-noconflict/theme-solarized_dark";
import "ace-builds/src-noconflict/ext-language_tools";

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

    const getMode = () => {
        const ext = path.split('.').pop()?.toLowerCase();
        switch (ext) {
            case 'js': return 'javascript';
            case 'ts': case 'tsx': return 'typescript';
            case 'css': return 'css';
            case 'html': return 'html';
            case 'json': return 'json';
            case 'md': return 'markdown';
            default: return 'text';
        }
    };

    if (loading) return <div className="p-8 text-center text-dim">Loading {path}...</div>;

    const getAceTheme = () => {
        switch (theme) {
            case 'matrix': return 'terminal';
            case 'nord': return 'nord_dark';
            case 'solarized': return 'solarized_dark';
            default: return 'monokai';
        }
    };

    return (
        <div className={`code-editor-container ${isMaximized ? 'maximized' : ''}`} style={{
            display: 'flex', flexDirection: 'column', height: '100%',
            background: '#1a1a1a', borderLeft: '1px solid var(--glass-border)'
        }}>
            <div className="editor-toolbar" style={{
                padding: '8px 16px', borderBottom: '1px solid #333',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: '#252525'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '12px', color: '#aaa', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{path.split('/').pop()}</span>
                    {saving && <span style={{ fontSize: '10px', color: 'var(--accent-color)' }}>Saving...</span>}
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={handleSave} className="tool-btn" title="Save (Ctrl+S)">
                        <Save size={16} />
                    </button>
                    <button onClick={() => setIsMaximized(!isMaximized)} className="tool-btn">
                        {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </button>
                    <button onClick={onClose} className="tool-btn" style={{ color: '#ff5555' }}>
                        <X size={16} />
                    </button>
                </div>
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
                <AceEditor
                    mode={getMode()}
                    theme={getAceTheme()}
                    onChange={setContent}
                    value={content}
                    name="ryo-editor"
                    editorProps={{ $blockScrolling: true }}
                    width="100%"
                    height="100%"
                    fontSize={14}
                    setOptions={{
                        enableBasicAutocompletion: true,
                        enableLiveAutocompletion: true,
                        enableSnippets: true,
                        showLineNumbers: true,
                        tabSize: 2,
                    }}
                />
            </div>
        </div>
    );
}
