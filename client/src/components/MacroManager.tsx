import { useState, useEffect } from "react";
import { Zap, Trash2, Save, CheckCircle2, Clock } from "lucide-react";

interface Macro {
    name: string;
    commands: string[];
    isDefault: boolean;
}

interface MacroManagerProps {
    token: string;
}

export function MacroManager({ token }: MacroManagerProps) {
    const [macros, setMacros] = useState<Macro[]>([]);
    const [name, setName] = useState("");
    const [commands, setCommands] = useState("");
    const [isDefault, setIsDefault] = useState(false);
    const [loading, setLoading] = useState(false);

    const fetchMacros = async () => {
        try {
            const res = await fetch("http://localhost:3001/api/macros", {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setMacros(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMacros();
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const cmdList = commands.split("\n").map(c => c.trim()).filter(c => c.length > 0);
            await fetch("http://localhost:3001/api/macros", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ name, commands: cmdList, isDefault })
            });
            setName("");
            setCommands("");
            setIsDefault(false);
            fetchMacros();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (macroName: string) => {
        try {
            await fetch(`http://localhost:3001/api/macros/${macroName}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
            });
            fetchMacros();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col h-full bg-secondary p-4 overflow-y-auto" style={{ width: '300px' }}>
            <div className="flex items-center gap-2 mb-6 text-accent">
                <Zap size={20} />
                <h2 className="text-sm font-bold tracking-wider uppercase">Startup Macros</h2>
            </div>

            <form onSubmit={handleSave} className="space-y-4 mb-8">
                <div className="space-y-1">
                    <label className="text-[10px] text-dim uppercase font-bold">Macro Name</label>
                    <input
                        type="text"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-tertiary border border-glass-border rounded p-2 text-xs text-white outline-none focus:border-accent"
                        placeholder="e.g. Dev Setup"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-dim uppercase font-bold">Commands (one per line)</label>
                    <textarea
                        value={commands}
                        onChange={e => setCommands(e.target.value)}
                        className="w-full bg-tertiary border border-glass-border rounded p-2 text-xs text-white outline-none focus:border-accent h-24 font-mono"
                        placeholder="npm run dev&#10;ls -la"
                        required
                    />
                </div>

                <div className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        id="isDefault"
                        checked={isDefault}
                        onChange={e => setIsDefault(e.target.checked)}
                        className="accent-accent"
                    />
                    <label htmlFor="isDefault" className="text-[10px] text-dim uppercase font-bold cursor-pointer">Set as Default</label>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-accent text-black font-bold py-2 rounded text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                    <Save size={14} /> {loading ? "Saving..." : "Save Macro"}
                </button>
            </form>

            <div className="space-y-3">
                <div className="text-[10px] text-dim uppercase font-bold border-b border-glass-border pb-2">Your Macros</div>
                {macros.map((m, i) => (
                    <div key={i} className="bg-tertiary border border-glass-border rounded p-3 space-y-2 relative group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-white">{m.name}</span>
                                {m.isDefault && <CheckCircle2 size={12} className="text-accent" />}
                            </div>
                            <button onClick={() => handleDelete(m.name)} className="text-dim hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 size={14} />
                            </button>
                        </div>
                        <div className="text-[9px] text-dim font-mono truncate">
                            {m.commands.join(" && ")}
                        </div>
                    </div>
                ))}
                {macros.length === 0 && <div className="text-[10px] text-dim italic text-center py-4">No macros saved yet</div>}
            </div>

            <div className="mt-8 border-t border-glass-border pt-4">
                <p className="text-[10px] text-dim italic">
                    <Clock size={10} className="inline mr-1" /> Default macros run automatically when a new terminal session starts.
                </p>
            </div>
        </div>
    );
}
