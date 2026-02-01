import { ShoppingBag, GitBranch, Cpu, Layers } from "lucide-react";

const AVAILABLE_PLUGINS = [
    {
        id: 'git-graph',
        name: 'Git Graph',
        description: 'Visualize your repository history with a beautful interactive graph.',
        icon: GitBranch,
        author: 'Ryo Team',
        status: 'Available'
    },
    {
        id: 'docker-manager',
        name: 'Docker Manager',
        description: 'Manage containers, images, and volumes directly from the sidebar.',
        icon: Layers,
        author: 'Ryo Team',
        status: 'Coming Soon'
    },
    {
        id: 'resource-monitor',
        name: 'Process Monitor',
        description: 'Advanced real-time process management and resource tracking.',
        icon: Cpu,
        author: 'Community',
        status: 'In Development'
    }
];

export function Marketplace() {
    return (
        <div className="flex flex-col h-full bg-secondary p-4 overflow-y-auto" style={{ width: '300px' }}>
            <div className="flex items-center gap-2 mb-6 text-accent">
                <ShoppingBag size={20} />
                <h2 className="text-sm font-bold tracking-wider uppercase">Marketplace</h2>
            </div>

            <div className="space-y-4">
                {AVAILABLE_PLUGINS.map(p => (
                    <div key={p.id} className="bg-tertiary border border-glass-border rounded-xl p-4 space-y-3 group hover:border-accent transition-colors">
                        <div className="flex items-start justify-between">
                            <div className="p-2 bg-glass-bg rounded-lg">
                                <p.icon size={20} className="text-accent" />
                            </div>
                            <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${p.status === 'Available' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                                }`}>
                                {p.status}
                            </span>
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white">{p.name}</h3>
                            <p className="text-[11px] text-dim leading-relaxed mt-1">{p.description}</p>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-glass-border">
                            <span className="text-[10px] text-dim">By {p.author}</span>
                            <button className="text-[10px] font-bold text-accent uppercase hover:underline disabled:opacity-50" disabled={p.status !== 'Available'}>
                                {p.status === 'Available' ? 'Install' : 'Notify'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <div className="mt-8 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                <h4 className="text-xs font-bold text-accent mb-2">Developer?</h4>
                <p className="text-[10px] text-dim leading-relaxed">
                    Build your own Ryo Extension using our TypeScript SDK. Coming soon to the Ryo Marketplace.
                </p>
            </div>
        </div>
    );
}
