import { Files, Activity, ShieldCheck, Palette, Zap, ShoppingBag, Clock } from "lucide-react";
import { pluginRegistry } from "./utils/pluginRegistry";
import React from "react";

// Lazy-loaded components
const FileExplorer = React.lazy(() => import("./components/FileExplorer").then(m => ({ default: m.FileExplorer })));
const Dashboard = React.lazy(() => import("./components/Dashboard").then(m => ({ default: m.Dashboard })));
const UserAdmin = React.lazy(() => import("./components/UserAdmin").then(m => ({ default: m.UserAdmin })));
const ThemeBuilder = React.lazy(() => import("./components/ThemeBuilder").then(m => ({ default: m.ThemeBuilder })));
const MacroManager = React.lazy(() => import("./components/MacroManager").then(m => ({ default: m.MacroManager })));
const Marketplace = React.lazy(() => import("./components/Marketplace").then(m => ({ default: m.Marketplace })));
const History = React.lazy(() => import("./components/History").then(m => ({ default: m.History })));

export function registerCorePlugins() {
    pluginRegistry.register({
        id: 'files',
        name: 'Files',
        icon: Files,
        component: FileExplorer
    });

    pluginRegistry.register({
        id: 'history',
        name: 'History',
        icon: Clock,
        component: History
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
