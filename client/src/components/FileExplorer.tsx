import { useState, memo } from "react";
import { Folder, File, ChevronRight, RefreshCcw, FilePlus, FolderPlus, Edit3, Trash2, X, Check, Download, UploadCloud } from "lucide-react";
import useSWR from "swr";

interface FileExplorerProps {
    token: string;
    onSelectFolder: (path: string) => void;
    onSelectFile: (path: string) => void;
}

interface FileItem {
    name: string;
    isDirectory: boolean;
    path: string;
    size: number;
}

const fetcher = (url: string, token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

const FileItemComponent = memo(({ file, renamingPath, newName, setNewName, onSelect, onDoubleClick, onRename, onCancelRename, onDelete, onDownload }: any) => {
    return (
        <div
            className="explorer-item group"
            onClick={onSelect}
            onDoubleClick={onDoubleClick}
            style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 8px',
                cursor: 'pointer', fontSize: '13px', borderRadius: '4px',
                transition: 'background 0.2s',
                marginBottom: '2px',
                position: 'relative'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            {renamingPath === file.path ? (
                <>
                    {file.isDirectory ? <Folder size={14} color="#88c0d0" /> : <File size={14} color="var(--text-dim)" />}
                    <input
                        autoFocus
                        value={newName}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setNewName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && onRename(file.path)}
                        style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', padding: '2px 4px', borderRadius: '2px' }}
                    />
                    <Check size={12} onClick={(e) => { e.stopPropagation(); onRename(file.path); }} />
                    <X size={12} onClick={(e) => { e.stopPropagation(); onCancelRename(); }} />
                </>
            ) : (
                <>
                    {file.isDirectory ? <Folder size={14} color="#88c0d0" /> : <File size={14} color="var(--text-dim)" />}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{file.name}</span>
                    <div className="explorer-actions" style={{ display: 'none', gap: '6px' }}>
                        {!file.isDirectory && <Download size={12} className="text-dim hover:text-white" onClick={(e) => { e.stopPropagation(); onDownload(file.path, file.name); }} />}
                        <Edit3 size={12} className="text-dim hover:text-white" onClick={(e) => { e.stopPropagation(); onRename(file.path, file.name); }} />
                        <Trash2 size={12} className="text-danger hover:text-red-400" onClick={(e) => { e.stopPropagation(); onDelete(file.path); }} />
                    </div>
                </>
            )}
        </div>
    );
});

export function FileExplorer({ token, onSelectFolder, onSelectFile }: FileExplorerProps) {
    const [currentPath, setCurrentPath] = useState<string>("");
    const [isCreating, setIsCreating] = useState<"file" | "folder" | null>(null);
    const [renamingPath, setRenamingPath] = useState<string | null>(null);
    const [newName, setNewName] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const { data: files, error, mutate, isLoading } = useSWR(
        token ? [`http://localhost:3001/api/files?path=${currentPath}`, token] : null,
        ([url, t]) => fetcher(url, t)
    );

    const handleBack = () => {
        const parts = currentPath.split("/");
        parts.pop();
        setCurrentPath(parts.join("/"));
    };

    const handleFileUpload = async (files: FileList) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", files[0]);

        try {
            await fetch(`http://localhost:3001/api/upload?path=${currentPath}`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
                body: formData
            });
            mutate();
        } catch (e) {
            console.error("Upload failed", e);
        } finally {
            setIsUploading(false);
        }
    };

    const handleDownload = async (filePath: string, fileName: string) => {
        try {
            const res = await fetch(`http://localhost:3001/api/files/content?path=${filePath}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            const blob = new Blob([data.content], { type: 'text/plain' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    const handleCreate = async () => {
        if (!newName) return;
        const targetPath = currentPath ? `${currentPath}/${newName}` : newName;
        await fetch("http://localhost:3001/api/files/create", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ path: targetPath, isDirectory: isCreating === "folder" })
        });
        setIsCreating(null);
        setNewName("");
        mutate();
    };

    const handleRename = async (oldPath: string) => {
        if (!newName) return;
        const parent = oldPath.split("/").slice(0, -1).join("/");
        const newPath = parent ? `${parent}/${newName}` : newName;
        await fetch("http://localhost:3001/api/files/rename", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ oldPath, newPath })
        });
        setRenamingPath(null);
        setNewName("");
        mutate();
    };

    const handleDelete = async (path: string) => {
        if (!confirm("Are you sure you want to delete this?")) return;
        await fetch(`http://localhost:3001/api/files?path=${path}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
        });
        mutate();
    };

    if (error) return <div className="p-4 text-danger">Error loading files</div>;

    return (
        <div
            className="file-explorer"
            style={{
                width: '240px', background: 'rgba(255,255,255,0.02)',
                borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column',
                position: 'relative'
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files) handleFileUpload(e.dataTransfer.files);
            }}
        >
            {isDragging && (
                <div style={{
                    position: 'absolute', inset: 0, zIndex: 10,
                    background: 'rgba(136, 192, 208, 0.15)', backdropFilter: 'blur(4px)',
                    border: '2px dashed #88c0d0', borderRadius: '4px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', color: '#88c0d0', pointerEvents: 'none'
                }}>
                    <UploadCloud size={32} />
                    <span style={{ fontSize: '12px', fontWeight: 'bold' }}>DROP TO UPLOAD</span>
                </div>
            )}

            {isUploading && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--accent-color)', animation: 'shimmer 1.5s infinite' }} />
            )}

            <div className="explorer-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-dim)' }}>EXPLORER</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <FilePlus size={14} className="cursor-pointer text-dim hover:text-white" onClick={() => { setIsCreating("file"); setNewName(""); }} />
                    <FolderPlus size={14} className="cursor-pointer text-dim hover:text-white" onClick={() => { setIsCreating("folder"); setNewName(""); }} />
                    <RefreshCcw size={14} className="cursor-pointer text-dim hover:text-white" onClick={() => mutate()} />
                </div>
            </div>

            <div className="explorer-content" style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                {isCreating && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                        {isCreating === "folder" ? <Folder size={14} color="#88c0d0" /> : <File size={14} color="var(--text-dim)" />}
                        <input
                            autoFocus
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: 'none', color: '#fff', fontSize: '12px', outline: 'none', padding: '2px 4px', borderRadius: '2px' }}
                        />
                        <Check size={12} className="cursor-pointer" onClick={handleCreate} />
                        <X size={12} className="cursor-pointer" onClick={() => setIsCreating(null)} />
                    </div>
                )}
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
                    <>
                        {files?.map((file: FileItem) => (
                            <FileItemComponent
                                key={file.path}
                                file={file}
                                renamingPath={renamingPath}
                                newName={newName}
                                setNewName={setNewName}
                                onSelect={() => file.isDirectory ? setCurrentPath(file.path) : onSelectFile(file.path)}
                                onDoubleClick={() => file.isDirectory && onSelectFolder(file.path)}
                                onRename={(path: string, name?: string) => {
                                    if (name !== undefined) {
                                        setRenamingPath(path);
                                        setNewName(name);
                                    } else {
                                        handleRename(path);
                                    }
                                }}
                                onCancelRename={() => setRenamingPath(null)}
                                onDelete={() => handleDelete(file.path)}
                                onDownload={handleDownload}
                            />
                        ))}
                        <style>{`
                            .explorer-item:hover .explorer-actions { display: flex !important; }
                        `}</style>
                    </>
                )}
            </div>
        </div>
    );
}
