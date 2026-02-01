import { Palette, RefreshCw, Save, X, Sparkles, Moon, Sun, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from 'react';

interface ThemeBuilderProps {
    onClose: () => void;
}

interface ThemeConfig {
    '--accent-primary': string;
    '--bg-primary': string;
    '--bg-secondary': string;
    '--glass-opacity': string;
    '--glass-blur': string;
    '--font-main': string;
}

const DEFAULT_THEME: ThemeConfig = {
    '--accent-primary': '#39bae6',
    '--bg-primary': '#0a0e14',
    '--bg-secondary': '#151a21',
    '--glass-opacity': '0.3',
    '--glass-blur': '20px',
    '--font-main': "'Inter', system-ui, sans-serif"
};

export function ThemeBuilder({ onClose }: ThemeBuilderProps) {
    const [theme, setTheme] = useState<ThemeConfig>(() => {
        const saved = localStorage.getItem('ryo_custom_theme');
        return saved ? JSON.parse(saved) : DEFAULT_THEME;
    });

    useEffect(() => {
        const root = document.documentElement;
        Object.entries(theme).forEach(([key, value]) => {
            root.style.setProperty(key, value);
        });
        localStorage.setItem('ryo_custom_theme', JSON.stringify(theme));

        // Specialized glass background update
        root.style.setProperty('--glass-bg', `rgba(21, 26, 33, ${theme['--glass-opacity']})`);
        root.style.setProperty('--glass-blur', theme['--glass-blur']);
    }, [theme]);

    const handleChange = (key: keyof ThemeConfig, value: string) => {
        setTheme(prev => ({ ...prev, [key]: value }));
    };

    const resetTheme = () => setTheme(DEFAULT_THEME);

    // Helper to check if the current theme matches a preset for displaying CheckCircle2
    const isPresetActive = (presetTheme: Partial<ThemeConfig>) => {
        return Object.entries(presetTheme).every(([key, value]) => theme[key as keyof ThemeConfig] === value);
    };

    return (
        <div className="flex flex-col h-full bg-secondary p-4 overflow-y-auto" style={{ width: '300px' }}>
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-accent">
                    <Palette size={20} />
                    <h2 className="text-sm font-bold tracking-wider uppercase">Theme Builder</h2>
                </div>
                <button onClick={onClose} className="text-dim hover:text-white">
                    <X size={16} />
                </button>
            </div>

            <div className="space-y-6">
                {/* Accent Color */}
                <div className="space-y-2">
                    <label className="text-[10px] text-dim uppercase font-bold flex items-center gap-1">
                        <Sparkles size={10} /> Accent Color
                    </label>
                    <div className="flex gap-2 items-center">
                        <input
                            type="color"
                            value={theme['--accent-primary']}
                            onChange={e => handleChange('--accent-primary', e.target.value)}
                            className="w-8 h-8 rounded border-none bg-transparent cursor-pointer"
                        />
                        <input
                            type="text"
                            value={theme['--accent-primary']}
                            onChange={e => handleChange('--accent-primary', e.target.value)}
                            className="flex-1 bg-tertiary border border-glass-border rounded p-2 text-xs text-white outline-none"
                        />
                    </div>
                </div>

                {/* Glass Opacity */}
                <div className="space-y-2">
                    <label className="text-[10px] text-dim uppercase font-bold">Glass Transparency</label>
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={theme['--glass-opacity']}
                        onChange={e => handleChange('--glass-opacity', e.target.value)}
                        className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-dim">
                        <span>Clear</span>
                        <span>Opaque</span>
                    </div>
                </div>

                {/* Glass Blur */}
                <div className="space-y-2">
                    <label className="text-[10px] text-dim uppercase font-bold">Blur Intensity</label>
                    <input
                        type="range"
                        min="0"
                        max="50"
                        step="1"
                        value={parseInt(theme['--glass-blur'])}
                        onChange={e => handleChange('--glass-blur', `${e.target.value}px`)}
                        className="w-full accent-accent"
                    />
                    <div className="flex justify-between text-[10px] text-dim">
                        <span>Sharp</span>
                        <span>Frosted</span>
                    </div>
                </div>

                {/* Preset Fast Themes */}
                <div className="space-y-2">
                    <label className="text-[10px] text-dim uppercase font-bold">Presets</label>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setTheme({ ...theme, '--accent-primary': '#39bae6', '--bg-primary': '#0a0e14' })}
                            className="bg-tertiary hover:bg-glass-border p-2 rounded text-[10px] flex items-center gap-2 border border-glass-border"
                        >
                            <Sun size={10} className="text-accent" /> Ryo Blue
                            {isPresetActive({ '--accent-primary': '#39bae6', '--bg-primary': '#0a0e14' }) && <CheckCircle2 size={12} className="text-accent ml-auto" />}
                        </button>
                        <button
                            onClick={() => setTheme({ ...theme, '--accent-primary': '#7fd962', '--bg-primary': '#050505' })}
                            className="bg-tertiary hover:bg-glass-border p-2 rounded text-[10px] flex items-center gap-2 border border-glass-border"
                        >
                            <Moon size={10} className="text-green-400" /> Matrix
                            {isPresetActive({ '--accent-primary': '#7fd962', '--bg-primary': '#050505' }) && <CheckCircle2 size={12} className="text-accent ml-auto" />}
                        </button>
                        <button
                            onClick={() => setTheme({ ...theme, '--accent-primary': '#f07178', '--bg-primary': '#1a1010' })}
                            className="bg-tertiary hover:bg-glass-border p-2 rounded text-[10px] flex items-center gap-2 border border-glass-border"
                        >
                            <Sun size={10} className="text-red-400" /> Crimson
                        </button>
                        <button
                            onClick={() => setTheme({ ...theme, '--accent-primary': '#c792ea', '--bg-primary': '#0f111a' })}
                            className="bg-tertiary hover:bg-glass-border p-2 rounded text-[10px] flex items-center gap-2 border border-glass-border"
                        >
                            <Moon size={10} className="text-purple-400" /> Cyber
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-auto pt-6 border-t border-glass-border flex gap-2">
                <button
                    onClick={resetTheme}
                    className="flex-1 bg-tertiary text-dim hover:text-white py-2 rounded text-xs flex items-center justify-center gap-2 transition-colors border border-glass-border"
                >
                    <RefreshCw size={14} /> Reset
                </button>
                <button
                    onClick={() => {
                        localStorage.setItem('ryo_custom_theme', JSON.stringify(theme));
                        onClose();
                    }}
                    className="flex-1 bg-accent text-black font-bold py-2 rounded text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                    <Save size={14} /> Done
                </button>
            </div>
        </div>
    );
}
