import type { LucideIcon } from "lucide-react";
import React from "react";

export interface RyoPlugin {
    id: string;
    name: string;
    icon: LucideIcon;
    component: React.ComponentType<any>;
    roleRequired?: 'admin' | 'user';
}

class PluginRegistry {
    private plugins: Map<string, RyoPlugin> = new Map();

    register(plugin: RyoPlugin) {
        this.plugins.set(plugin.id, plugin);
    }

    getPlugins(userRole?: string): RyoPlugin[] {
        return Array.from(this.plugins.values()).filter(p => {
            if (!p.roleRequired) return true;
            return p.roleRequired === userRole;
        });
    }

    getPlugin(id: string): RyoPlugin | undefined {
        return this.plugins.get(id);
    }
}

export const pluginRegistry = new PluginRegistry();
