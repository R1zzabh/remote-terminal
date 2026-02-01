import { Router, Request, Response } from "express";
import si from "systeminformation";
import { verifyToken } from "../auth/index.js";
import { logger } from "../utils/logger.js";

const router = Router();

router.get("/stats", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    try {
        const [cpu, mem, fs] = await Promise.all([
            si.currentLoad(),
            si.mem(),
            si.fsSize()
        ]);

        res.json({
            cpu: {
                load: cpu.currentLoad,
                cores: cpu.cpus.map(c => c.load)
            },
            memory: {
                total: mem.total,
                active: mem.active,
                used: mem.used,
                percent: (mem.active / mem.total) * 100
            },
            disk: fs.map(f => ({
                mount: f.mount,
                used: f.used,
                size: f.size,
                percent: f.use
            }))
        });
    } catch (error) {
        logger.error("Failed to fetch system stats", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.get("/processes", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    try {
        const procs = await si.processes();
        // Return top 50 processes by CPU usage
        const list = procs.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 50)
            .map(p => ({
                pid: p.pid,
                name: p.name,
                cpu: p.cpu,
                mem: p.mem,
                user: p.user,
                command: p.command
            }));
        res.json(list);
    } catch (error) {
        logger.error("Failed to fetch processes", { error });
        res.status(500).json({ error: "Internal Server Error" });
    }
});

router.post("/kill", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    const { pid } = req.body;
    if (!pid) return res.status(400).json({ error: "PID required" });

    // Security Audit: Prevent killing core system processes
    if (pid < 100) {
        logger.warn(`SECURITY: Blocked attempt to kill system process ${pid}`, { token });
        return res.status(403).json({ error: "Access Denied: Cannot kill system processes." });
    }

    try {
        process.kill(pid, "SIGTERM");
        logger.info(`Process killed: ${pid}`);
        res.json({ success: true });
    } catch (error) {
        logger.error(`Failed to kill process ${pid}`, { error });
        res.status(500).json({ error: "Failed to kill process" });
    }
});

router.get("/report", async (req: Request, res: Response) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token || !verifyToken(token)) return res.status(401).json({ error: "Unauthorized" });

    try {
        const [os, cpu, mem, disk] = await Promise.all([
            si.osInfo(),
            si.cpu(),
            si.mem(),
            si.fsSize()
        ]);

        const report = `
RYO TERMINAL SYSTEM REPORT
Generated: ${new Date().toISOString()}
----------------------------------------
OS: ${os.distro} ${os.release} (${os.arch})
Hostname: ${os.hostname}
Kernel: ${os.kernel}

CPU: ${cpu.manufacturer} ${cpu.brand}
Cores: ${cpu.cores} (${cpu.physicalCores} physical)
Speed: ${cpu.speed} GHz

MEMORY:
Total: ${(mem.total / 1024 / 1024 / 1024).toFixed(2)} GB
Free: ${(mem.free / 1024 / 1024 / 1024).toFixed(2)} GB
Used: ${(mem.used / 1024 / 1024 / 1024).toFixed(2)} GB

STORAGE:
${disk.map(d => `${d.mount}: ${d.use}% used of ${(d.size / 1024 / 1024 / 1024).toFixed(2)} GB`).join("\n")}
----------------------------------------
End of Report
        `.trim();

        res.type("text/plain").send(report);
    } catch (error) {
        logger.error("Failed to generate report", { error });
        res.status(500).send("Failed to generate report");
    }
});

export default router;
