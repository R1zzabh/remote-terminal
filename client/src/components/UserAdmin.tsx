import { useState } from "react";
import { UserPlus, Shield, User as UserIcon, Home, Key } from "lucide-react";
import { clsx } from "clsx";

interface UserAdminProps {
    token: string;
}

export function UserAdmin({ token }: UserAdminProps) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState<"admin" | "user">("user");
    const [homeDir, setHomeDir] = useState("");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess("");

        try {
            const res = await fetch("http://localhost:3001/api/users", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ username, password, role, homeDir })
            });

            const data = await res.json();
            if (res.ok) {
                setSuccess(`User ${username} created successfully!`);
                setUsername("");
                setPassword("");
                setHomeDir("");
            } else {
                setError(data.error || "Failed to create user");
            }
        } catch (err) {
            setError("Network error");
        }
    };

    return (
        <div className="flex flex-col h-full bg-secondary p-4 overflow-y-auto" style={{ width: '300px' }}>
            <div className="flex items-center gap-2 mb-6 text-accent">
                <Shield size={20} />
                <h2 className="text-sm font-bold tracking-wider uppercase">User Management</h2>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-[10px] text-dim uppercase font-bold flex items-center gap-1">
                        <UserIcon size={10} /> Username
                    </label>
                    <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        className="w-full bg-tertiary border border-glass-border rounded p-2 text-xs text-white outline-none focus:border-accent"
                        placeholder="john_doe"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-dim uppercase font-bold flex items-center gap-1">
                        <Key size={10} /> Password
                    </label>
                    <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        className="w-full bg-tertiary border border-glass-border rounded p-2 text-xs text-white outline-none focus:border-accent"
                        placeholder="••••••••"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-dim uppercase font-bold flex items-center gap-1">
                        <Home size={10} /> Home Directory
                    </label>
                    <input
                        type="text"
                        value={homeDir}
                        onChange={e => setHomeDir(e.target.value)}
                        className="w-full bg-tertiary border border-glass-border rounded p-2 text-xs text-white outline-none focus:border-accent"
                        placeholder="/home/john"
                        required
                    />
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] text-dim uppercase font-bold">Role</label>
                    <div className="flex gap-2">
                        {["user", "admin"].map(r => (
                            <button
                                key={r}
                                type="button"
                                onClick={() => setRole(r as any)}
                                className={clsx(
                                    "flex-1 p-2 rounded text-[10px] font-bold uppercase transition-all",
                                    role === r ? "bg-accent text-black" : "bg-tertiary text-dim border border-glass-border"
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>

                <button
                    type="submit"
                    className="w-full bg-accent text-black font-bold py-2 rounded text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                >
                    <UserPlus size={14} /> Create User
                </button>

                {error && <div className="text-[10px] text-red-400 bg-red-400/10 p-2 rounded border border-red-400/20">{error}</div>}
                {success && <div className="text-[10px] text-green-400 bg-green-400/10 p-2 rounded border border-green-400/20">{success}</div>}
            </form>

            <div className="mt-8 border-t border-glass-border pt-4">
                <p className="text-[10px] text-dim italic">
                    Note: For security, users are strictly confined to their Home Directory. Admin users have global access if their Home Directory is set to root (/).
                </p>
            </div>
        </div>
    );
}
