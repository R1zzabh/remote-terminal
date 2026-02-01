import { useState, useEffect, useRef } from "react";
import { Search, Terminal, LogOut, Palette, Activity } from "lucide-react";
import { clsx } from "clsx";

interface CommandPaletteProps {
    onAction: (action: string, value?: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const COMMANDS = [
    { id: "clear", label: "Clear Terminal", icon: Terminal, hotkey: "L" },
    { id: "theme-dark", label: "Set Theme: Ryo Dark", icon: Palette },
    { id: "theme-matrix", label: "Set Theme: Matrix", icon: Palette },
    { id: "theme-nord", label: "Set Theme: Nord", icon: Palette },
    { id: "theme-solarized", label: "Set Theme: Solarized", icon: Palette },
    { id: "status", label: "Refresh Connection", icon: Activity },
    { id: "logout", label: "Terminate Session", icon: LogOut, danger: true },
];

export function CommandPalette({ onAction, isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredCommands = COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
    );

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === "ArrowDown") {
                setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
            } else if (e.key === "ArrowUp") {
                setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
            } else if (e.key === "Enter") {
                const cmd = filteredCommands[selectedIndex];
                if (cmd) {
                    onAction(cmd.id);
                    onClose();
                }
            } else if (e.key === "Escape") {
                onClose();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredCommands, selectedIndex, onAction, onClose]);

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette-content" onClick={e => e.stopPropagation()}>
                <div className="command-palette-search">
                    <Search size={18} className="text-dim" />
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search commands..."
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="command-palette-hint">ESC</div>
                </div>
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
                                onAction(cmd.id);
                                onClose();
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
            </div>
        </div>
    );
}
