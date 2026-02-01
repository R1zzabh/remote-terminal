import { useEffect } from "react";

interface ShortcutManagerProps {
    onAction: (action: string) => void;
}

export function ShortcutManager({ onAction }: ShortcutManagerProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only trigger if Ctrl+Shift or Cmd+Shift is pressed
            const isMod = (e.ctrlKey || e.metaKey) && e.shiftKey;
            if (!isMod) return;

            switch (e.key.toUpperCase()) {
                case 'T':
                    e.preventDefault();
                    onAction('new-tab');
                    break;
                case 'W':
                    e.preventDefault();
                    onAction('close-tab');
                    break;
                case 'P':
                    e.preventDefault();
                    onAction('palette');
                    break;
                case 'E':
                    e.preventDefault();
                    onAction('toggle-sidebar');
                    break;
                case 'D':
                    e.preventDefault();
                    onAction('split-vertical');
                    break;
                case 'S':
                    e.preventDefault();
                    onAction('split-horizontal');
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onAction]);

    return null;
}
