import useSWR from "swr";
import { Activity, Cpu, Database, HardDrive, Trash2, RefreshCw } from "lucide-react";

interface DashboardProps {
    token: string;
}

const fetcher = (url: string, token: string) =>
    fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.json());

export function Dashboard({ token }: DashboardProps) {
    const { data: stats, mutate: mutateStats } = useSWR(
        token ? [`http://localhost:3001/api/system/stats`, token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 5000 }
    );

    const { data: processes, mutate: mutateProcs } = useSWR(
        token ? [`http://localhost:3001/api/system/processes`, token] : null,
        ([url, t]) => fetcher(url, t),
        { refreshInterval: 10000 }
    );

    const handleKill = async (pid: number) => {
        if (!confirm(`Kill process ${pid}?`)) return;
        await fetch(`http://localhost:3001/api/system/kill`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ pid })
        });
        mutateProcs();
    };

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="system-dashboard" style={{
            width: '300px', background: 'rgba(255,255,255,0.02)',
            borderRight: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column',
            overflowY: 'auto'
        }}>
            <div className="explorer-header" style={{ padding: '8px 12px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--text-dim)' }}>SYSTEM DASHBOARD</span>
                <RefreshCw size={14} className="cursor-pointer text-dim hover:text-white" onClick={() => { mutateStats(); mutateProcs(); }} />
            </div>

            <div className="p-4 flex flex-col gap-6">
                {/* CPU Section */}
                <div className="dashboard-section">
                    <div className="flex items-center gap-2 mb-3 text-dim">
                        <Cpu size={16} />
                        <span className="text-xs font-bold uppercase">CPU Usage</span>
                    </div>
                    <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                        <div
                            className="absolute top-0 left-0 h-full bg-accent transition-all duration-1000"
                            style={{ width: `${stats?.cpu?.load || 0}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-dim">
                        <span>Load: {stats?.cpu?.load.toFixed(1)}%</span>
                        <span>{stats?.cpu?.cores.length} Cores</span>
                    </div>
                </div>

                {/* RAM Section */}
                <div className="dashboard-section">
                    <div className="flex items-center gap-2 mb-3 text-dim">
                        <Database size={16} />
                        <span className="text-xs font-bold uppercase">Memory (RAM)</span>
                    </div>
                    <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden mb-2">
                        <div
                            className="absolute top-0 left-0 h-full bg-blue-400 transition-all duration-1000"
                            style={{ width: `${stats?.memory?.percent || 0}%` }}
                        />
                    </div>
                    <div className="flex justify-between text-[10px] text-dim">
                        <span>{formatBytes(stats?.memory?.active || 0)} used</span>
                        <span>{formatBytes(stats?.memory?.total || 0)} total</span>
                    </div>
                </div>

                {/* Disk Section */}
                <div className="dashboard-section">
                    <div className="flex items-center gap-2 mb-3 text-dim">
                        <HardDrive size={16} />
                        <span className="text-xs font-bold uppercase">Storage</span>
                    </div>
                    {stats?.disk?.slice(0, 2).map((d: any) => (
                        <div key={d.mount} className="mb-3 last:mb-0">
                            <div className="flex justify-between text-[9px] mb-1 text-dim">
                                <span>{d.mount}</span>
                                <span>{d.percent}%</span>
                            </div>
                            <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                <div
                                    className="absolute top-0 left-0 h-full bg-green-400"
                                    style={{ width: `${d.percent}%` }}
                                />
                            </div>
                        </div>
                    ))}
                </div>

                {/* Process Section */}
                <div className="dashboard-section">
                    <div className="flex items-center gap-2 mb-3 text-dim">
                        <Activity size={16} />
                        <span className="text-xs font-bold uppercase">Processes</span>
                    </div>
                    <div className="flex flex-col gap-1 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {processes?.map((p: any) => (
                            <div
                                key={p.pid}
                                className="group flex items-center justify-between p-2 rounded hover:bg-white/5 transition-colors"
                            >
                                <div className="flex flex-col min-w-0">
                                    <span className="text-xs text-white truncate font-medium">{p.name}</span>
                                    <div className="flex gap-2 text-[9px] text-dim">
                                        <span>PID: {p.pid}</span>
                                        <span>CPU: {p.cpu.toFixed(1)}%</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleKill(p.pid)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-danger hover:bg-danger/20 rounded transition-all"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
