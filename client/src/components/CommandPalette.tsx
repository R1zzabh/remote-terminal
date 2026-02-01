import { useState, useEffect, useRef } from "react";
import { Search, Terminal, LogOut, Palette, Activity, Sidebar, Globe } from "lucide-react";
import { clsx } from "clsx";

interface CommandPaletteProps {
    onAction: (action: string, value?: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const COMMANDS = [
    { id: "clear", label: "Clear Terminal", icon: Terminal, hotkey: "L" },
    { id: "ssh", label: "Connect to SSH...", icon: Globe },
    { id: "theme-dark", label: "Set Theme: Ryo Dark", icon: Palette },
    { id: "theme-matrix", label: "Set Theme: Matrix", icon: Palette },
    { id: "theme-nord", label: "Set Theme: Nord", icon: Palette },
    { id: "theme-solarized", label: "Set Theme: Solarized", icon: Palette },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: Sidebar },
    { id: "status", label: "Sync Sessions", icon: Activity },
    { id: "logout", label: "Terminate All & Logout", icon: LogOut, danger: true },
];

export function CommandPalette({ onAction, isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isSSHMode, setIsSSHMode] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredCommands = isSSHMode ? [] : COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setIsSSHMode(false);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "ArrowDown") {
                setSelectedIndex(prev => (prev + 1) % (filteredCommands.length || 1));
            } else if (e.key === "ArrowUp") {
                setSelectedIndex(prev => (prev - 1 + (filteredCommands.length || 1)) % (filteredCommands.length || 1));
            } else if (e.key === "Enter") {
                if (isSSHMode) {
                    if (query) {
                        onAction('ssh-connect', query);
                        onClose();
                    }
                    return;
                }

                const cmd = filteredCommands[selectedIndex];
                if (cmd) {
                    if (cmd.id === 'ssh') {
                        setIsSSHMode(true);
                        setQuery("");
                    } else {
                        onAction(cmd.id);
                        onClose();
                    }
                }
            } else if (e.key === "Escape") {
                if (isSSHMode) {
                    setIsSSHMode(false);
                    setQuery("");
                } else {
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onAction, onClose, isSSHMode, query]);

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette-content" onClick={e => e.stopPropagation()}>
                <div className="command-palette-search">
                    {isSSHMode ? <Globe size={18} className="text-accent" /> : <Search size={18} className="text-dim" />}
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={isSSHMode ? "user@hostname or host..." : "Search commands..."}
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="command-palette-hint">{isSSHMode ? "ENTER TO CONNECT" : "ESC"}</div>
                </div>
                {!isSSHMode && (
                    <div className="command-palette-list">
                        {filteredCommands.map((cmd, index) => (
                            <div
                                key={cmd.id}
                                className={clsx(
                                    "command-palette-item",
                                    index === selectedIndex && "active",
                                    cmd.danger && "danger"
                                )}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => {
                                    if (cmd.id === 'ssh') {
                                        setIsSSHMode(true);
                                        setQuery("");
                                    } else {
                                        onAction(cmd.id);
                                        onClose();
                                    }
                                }}
                            >
                                <div className="item-icon">
                                    <cmd.icon size={16} />
                                </div>
                                <div className="item-label">{cmd.label}</div>
                                {cmd.hotkey && <div className="item-hotkey">⌘{cmd.hotkey}</div>}
                            </div>
                        ))}
                        {filteredCommands.length === 0 && (
                            <div className="command-palette-empty">No commands found...</div>
                        )}
                    </div>
                )}
                {isSSHMode && (
                    <div className="p-4 text-dim text-xs">
                        Press ENTER to establish a new SSH session in a new tab.
                    </div>
                )}
            </div>
        </div>
    );
}
