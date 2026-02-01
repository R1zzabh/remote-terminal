interface MobileControlsProps {
    onSendKey: (key: string) => void;
}

export function MobileControls({ onSendKey }: MobileControlsProps) {
    const keys = [
        { label: "Ctrl", value: "\x01" }, // tmux prefix
        { label: "Esc", value: "\x1b" },
        { label: "Tab", value: "\t" },
        { label: "↑", value: "\x1b[A" },
        { label: "↓", value: "\x1b[B" },
        { label: "←", value: "\x1b[D" },
        { label: "→", value: "\x1b[C" },
        { label: "Ctrl+C", value: "\x03" },
        { label: "Ctrl+D", value: "\x04" },
    ];

    return (
        <div className="mobile-controls">
            {keys.map((key) => (
                <button
                    key={key.label}
                    className={`control-btn ${key.label === "Ctrl" ? "special" : ""}`}
                    onClick={() => onSendKey(key.value)}
                >
                    {key.label}
                </button>
            ))}
        </div>
    );
}
