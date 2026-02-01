import type { TmuxSession } from "../types";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function listTmuxSessions(): Promise<TmuxSession[]> {
    try {
        const { stdout } = await execAsync("tmux list-sessions -F '#{session_name}|#{session_windows}|#{session_attached}'");

        return stdout
            .trim()
            .split("\n")
            .filter(line => line)
            .map(line => {
                const [name, windows, attached] = line.split("|");
                return {
                    name,
                    windows: parseInt(windows) || 0,
                    attached: attached === "1",
                };
            });
    } catch (error) {
        // No sessions or tmux not running
        return [];
    }
}

export async function createTmuxSession(name: string): Promise<boolean> {
    try {
        await execAsync(`tmux new-session -d -s ${name}`);
        return true;
    } catch (error) {
        console.error(`Failed to create tmux session ${name}:`, error);
        return false;
    }
}

export async function killTmuxSession(name: string): Promise<boolean> {
    try {
        await execAsync(`tmux kill-session -t ${name}`);
        return true;
    } catch (error) {
        console.error(`Failed to kill tmux session ${name}:`, error);
        return false;
    }
}

export async function attachTmuxSession(name: string): Promise<string> {
    // Return the command to attach to a session
    return `tmux attach-session -t ${name}`;
}
