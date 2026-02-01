interface TouchToolbarProps {
    onKeyPress: (key: string) => void;
}

export function TouchToolbar({ onKeyPress }: TouchToolbarProps) {
    const keys = [
        { label: 'ESC', value: '\x1b' },
        { label: 'TAB', value: '\t' },
        { label: 'CTRL', value: 'ctrl' },
        { label: 'ALT', value: 'alt' },
        { label: '↑', value: '\x1b[A' },
        { label: '↓', value: '\x1b[B' },
        { label: '←', value: '\x1b[D' },
        { label: '→', value: '\x1b[C' },
    ];

    return (
        <div className="show-mobile" style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            background: 'var(--bg-secondary)',
            borderTop: '1px solid var(--glass-border)',
            padding: '8px',
            zIndex: 100
        }}>
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {keys.map(k => (
                    <button
                        key={k.label}
                        onClick={() => onKeyPress(k.value)}
                        style={{
                            minWidth: '44px',
                            height: '36px',
                            background: 'var(--bg-tertiary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '4px',
                            color: '#fff',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                        }}
                    >
                        {k.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
