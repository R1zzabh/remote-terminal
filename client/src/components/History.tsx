import { useState } from 'react';
import useSWR from 'swr';
import { Clock, Search, Trash2, Copy, ClipboardList, Terminal } from "lucide-react";

interface HistoryProps {
    token: string;
    onSelectCommand?: (cmd: string) => void;
}

const fetcher = (url: string, token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token} ` } }).then(res => res.json());

export function History({ token, onSelectCommand }: HistoryProps) {
    const [search, setSearch] = useState("");
    const { data: history, mutate } = useSWR(
        [`http://localhost:3001/api/history?q=${search}`, token],
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 5000 }
    );

    const handleClear = async () => {
        if (!confirm("Clear command history? (External shell history remains)")) return;
        await fetch('http://localhost:3001/api/history', {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` }
        });
        mutate([]);
    };

    const handleCopy = (cmd: string) => {
        navigator.clipboard.writeText(cmd);
    };

    return (
        <div className="flex flex-col h-full bg-[#0a0a0a] border-r border-[#333] w-[300px]">
            <div className="p-4 border-b border-[#333] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={16} className="text-accent" />
                    <span className="text-xs font-bold text-white uppercase tracking-wider">Session History</span>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => {
                            // Assuming history items are strings, as per history.map((cmd: string, i: number) => ...)
                            const allCmds = history?.join("\n");
                            if (allCmds) navigator.clipboard.writeText(allCmds);
                        }}
                        className="p-1 hover:bg-white/10 rounded text-dim hover:text-white"
                        title="Copy All History"
                    >
                        <ClipboardList size={14} />
                    </button>
                    <button onClick={handleClear} className="p-1 hover:bg-white/10 rounded text-red-500" title="Clear History">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            <div className="p-2 border-b border-[#333]">
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
                    <input
                        type="text"
                        placeholder="Search history..."
                        className="w-full bg-white/5 border border-white/10 rounded-md py-1.5 pl-9 pr-4 text-xs text-white focus:outline-none focus:border-accent/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar">
                {!history ? (
                    <div className="p-8 text-center text-dim text-xs">Loading history...</div>
                ) : history.length === 0 ? (
                    <div className="p-8 text-center text-dim text-xs">No history found</div>
                ) : (
                    <div className="flex flex-col">
                        {history.map((cmd: string, i: number) => (
                            <div
                                key={i}
                                className="group flex items-center justify-between p-3 border-b border-white/5 hover:bg-white/5 transition-all"
                            >
                                <div className="flex flex-col gap-1 min-w-0 flex-1">
                                    <code className="text-[11px] text-white truncate font-mono">{cmd}</code>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                                    <div title="Copy to clipboard">
                                        <Copy
                                            size={12}
                                            className="text-dim hover:text-white cursor-pointer"
                                            onClick={() => handleCopy(cmd)}
                                        />
                                    </div>
                                    <div title="Run in terminal">
                                        <Terminal
                                            size={12}
                                            className="text-accent hover:scale-110 cursor-pointer"
                                            onClick={() => onSelectCommand?.(cmd)}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
