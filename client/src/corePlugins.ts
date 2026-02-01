import { Files, Activity, ShieldCheck, Palette, Zap, ShoppingBag } from "lucide-react";
import { pluginRegistry } from "./utils/pluginRegistry";
import { FileExplorer } from "./components/FileExplorer";
import { Dashboard } from "./components/Dashboard";
import { UserAdmin } from "./components/UserAdmin";
import { ThemeBuilder } from "./components/ThemeBuilder";
import { MacroManager } from "./components/MacroManager";
import { Marketplace } from "./components/Marketplace";

export function registerCorePlugins() {
    pluginRegistry.register({
        id: 'files',
        name: 'Files',
        icon: Files,
        component: FileExplorer
    });

    pluginRegistry.register({
        id: 'system',
        name: 'System',
        icon: Activity,
        component: Dashboard
    });

    pluginRegistry.register({
        id: 'users',
        name: 'Users',
        icon: ShieldCheck,
        component: UserAdmin,
        roleRequired: 'admin'
    });

    pluginRegistry.register({
        id: 'theme',
        name: 'Theme',
        icon: Palette,
        component: ThemeBuilder
    });

    pluginRegistry.register({
        id: 'macros',
        name: 'Macros',
        icon: Zap,
        component: MacroManager
    });

    pluginRegistry.register({
        id: 'marketplace',
        name: 'Marketplace',
        icon: ShoppingBag,
        component: Marketplace
    });
}
