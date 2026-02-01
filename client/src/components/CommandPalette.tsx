import { useState, useEffect, useRef } from "react";
import { Search, Terminal, LogOut, Palette, Activity, Sidebar, Globe, Type, LayoutTemplate } from "lucide-react";
import { clsx } from "clsx";

interface CommandPaletteProps {
    onAction: (action: string, value?: string) => void;
    isOpen: boolean;
    onClose: () => void;
}

const FONTS = ["'JetBrains Mono'", "'Fira Code'", "'Roboto Mono'", "monospace"];

const COMMANDS = [
    { id: "clear", label: "Clear Terminal", icon: Terminal, hotkey: "L" },
    { id: "ssh", label: "Connect to SSH...", icon: Globe },
    { id: "font", label: "Change Font...", icon: Type },
    { id: "theme-dark", label: "Set Theme: Ryo Dark", icon: Palette },
    { id: "theme-matrix", label: "Set Theme: Matrix", icon: Palette },
    { id: "theme-nord", label: "Set Theme: Nord", icon: Palette },
    { id: "theme-solarized", label: "Set Theme: Solarized", icon: Palette },
    { id: "toggle-sidebar", label: "Toggle Sidebar", icon: Sidebar },
    { id: "split-horizontal", label: "Split Down", icon: LayoutTemplate },
    { id: "split-vertical", label: "Split Right", icon: LayoutTemplate },
    { id: "status", label: "Sync Sessions", icon: Activity },
    { id: "view-logs", label: "View System Logs", icon: Search },
    { id: "logout", label: "Terminate All & Logout", icon: LogOut, danger: true },
];

export function CommandPalette({ onAction, isOpen, onClose }: CommandPaletteProps) {
    const [query, setQuery] = useState("");
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [mode, setMode] = useState<"default" | "ssh" | "font">("default");
    const inputRef = useRef<HTMLInputElement>(null);

    const filteredCommands = mode === "default" ? COMMANDS.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
    ) : [];

    const filteredFonts = mode === "font" ? FONTS.filter(f =>
        f.toLowerCase().includes(query.toLowerCase())
    ) : [];

    useEffect(() => {
        if (isOpen) {
            setQuery("");
            setSelectedIndex(0);
            setMode("default");
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            const itemsCount = mode === "font" ? (filteredFonts.length || 1) : (filteredCommands.length || 1);

            if (e.key === "ArrowDown") {
                setSelectedIndex(prev => (prev + 1) % itemsCount);
            } else if (e.key === "ArrowUp") {
                setSelectedIndex(prev => (prev - 1 + itemsCount) % itemsCount);
            } else if (e.key === "Enter") {
                if (mode === "ssh") {
                    if (query) {
                        onAction('ssh-connect', query);
                        onClose();
                    }
                    return;
                }

                if (mode === "font") {
                    const font = filteredFonts[selectedIndex];
                    if (font) {
                        onAction('font-change', font);
                        onClose();
                    }
                    return;
                }

                const cmd = filteredCommands[selectedIndex];
                if (cmd) {
                    if (cmd.id === 'ssh') {
                        setMode("ssh");
                        setQuery("");
                    } else if (cmd.id === 'font') {
                        setMode("font");
                        setQuery("");
                    } else {
                        onAction(cmd.id);
                        onClose();
                    }
                }
            } else if (e.key === "Escape") {
                if (mode !== "default") {
                    setMode("default");
                    setQuery("");
                } else {
                    onClose();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, filteredCommands, filteredFonts, selectedIndex, onAction, onClose, mode, query]);

    if (!isOpen) return null;

    return (
        <div className="command-palette-overlay" onClick={onClose}>
            <div className="command-palette-content" onClick={e => e.stopPropagation()}>
                <div className="command-palette-search">
                    {mode === "ssh" && <Globe size={18} className="text-accent" />}
                    {mode === "font" && <Type size={18} className="text-accent" />}
                    {mode === "default" && <Search size={18} className="text-dim" />}
                    <input
                        ref={inputRef}
                        type="text"
                        placeholder={
                            mode === "ssh" ? "user@hostname or host..." :
                                mode === "font" ? "Filter fonts..." :
                                    "Search commands..."
                        }
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                    />
                    <div className="command-palette-hint">{mode !== "default" ? "ENTER TO SELECT" : "ESC"}</div>
                </div>

                {mode === "default" && (
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
                                        setMode("ssh");
                                        setQuery("");
                                    } else if (cmd.id === 'font') {
                                        setMode("font");
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
                    </div>
                )}

                {mode === "font" && (
                    <div className="command-palette-list">
                        {filteredFonts.map((font, index) => (
                            <div
                                key={font}
                                className={clsx("command-palette-item", index === selectedIndex && "active")}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => {
                                    onAction('font-change', font);
                                    onClose();
                                }}
                            >
                                <div className="item-icon"><Type size={16} /></div>
                                <div className="item-label">{font.replace(/'/g, '')}</div>
                            </div>
                        ))}
                    </div>
                )}

                {mode === "ssh" && (
                    <div className="p-4 text-dim text-xs">
                        Press ENTER to establish a new SSH session in a new tab.
                    </div>
                )}
            </div>
        </div>
    );
}
