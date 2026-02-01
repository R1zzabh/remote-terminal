import { useState } from "react";
import { Folder, File, ChevronRight, RefreshCcw } from "lucide-react";
import useSWR from "swr";

interface FileExplorerProps {
    token: string;
    onSelectFolder: (path: string) => void;
}

interface FileItem {
    name: string;
    isDirectory: boolean;
    path: string;
    size: number;
}

const fetcher = (url: string, token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

export function FileExplorer({ token, onSelectFolder }: FileExplorerProps) {
    const [currentPath, setCurrentPath] = useState<string>("");
    const { data: files, error, mutate, isLoading } = useSWR(
        token ? [`http://localhost:3001/api/files?path=${currentPath}`, token] : null,
        ([url, t]) => fetcher(url, t)
    );

    const handleBack = () => {
        const parts = currentPath.split("/");
        parts.pop();
        setCurrentPath(parts.join("/"));
    };

    if (error) return <div className="p-4 text-danger">Error loading files</div>;

    return (
        <div className="file-explorer" style={{
            width: '240px', background: 'rgba(255,255,255,0.02)',
            borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column'
        }}>
            <div className="explorer-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-dim)' }}>EXPLORER</span>
                <RefreshCcw size={14} className="cursor-pointer text-dim" onClick={() => mutate()} />
            </div>

            <div className="explorer-content" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {currentPath && (
                    <div
                        className="explorer-item"
                        onClick={handleBack}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-dim)' }}
                    >
                        <ChevronRight size={14} style={{ transform: 'rotate(180deg)' }} />
                        <span>..</span>
                    </div>
                )}

                {isLoading ? (
                    <div className="p-4 text-center text-dim text-xs">Loading...</div>
                ) : (
                    files?.map((file: FileItem) => (
                        <div
                            key={file.path}
                            className="explorer-item"
                            onClick={() => file.isDirectory ? setCurrentPath(file.path) : null}
                            onDoubleClick={() => file.isDirectory && onSelectFolder(file.path)}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px',
                                cursor: 'pointer', fontSize: '13px', borderRadius: '4px',
                                transition: 'background 0.2s',
                                marginBottom: '2px'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        >
                            {file.isDirectory ? <Folder size={14} color="#88c0d0" /> : <File size={14} color="var(--text-dim)" />}
                            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{file.name}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
