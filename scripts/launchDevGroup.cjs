#!/usr/bin/env node

const path = require("path");
const { spawn } = require("child_process");
const { runPreStartCommand, stopPreStartCommand } = require("./preStartCommand.cjs");

function parseArgs(argv) {
    const args = {};
    for (let i = 2; i < argv.length; i++) {
        const token = argv[i];
        if (token === "--group") {
            args.group = argv[++i];
        }
    }
    return args;
}

function buildConcurrentlyArgs(group) {
    if (group === "all") {
        return {
            names: "orchestrator,preprocessing,ai-model,data-provider,backend,frontend",
            commands: [
                "pnpm --filter orchestrator dev",
                "pnpm --filter preprocessing dev",
                "pnpm --filter ai-model dev",
                "pnpm --filter data-provider dev",
                "pnpm --filter webui-backend dev",
                "pnpm --filter vite-template dev"
            ]
        };
    }

    if (group === "backend") {
        return {
            names: "orchestrator,preprocessing,ai-model,data-provider,backend",
            commands: [
                "pnpm --filter orchestrator dev",
                "pnpm --filter preprocessing dev",
                "pnpm --filter ai-model dev",
                "pnpm --filter data-provider dev",
                "pnpm --filter webui-backend dev"
            ]
        };
    }

    if (group === "config") {
        return {
            names: "backend,frontend",
            commands: [
                "pnpm --filter webui-backend dev:config-panel",
                "pnpm --filter vite-template dev"
            ]
        };
    }

    if (group === "webui") {
        return {
            names: "ai-model,backend,frontend",
            commands: [
                "pnpm --filter ai-model dev",
                "pnpm --filter webui-backend dev",
                "pnpm --filter vite-template dev"
            ]
        };
    }

    if (group === "forwarder") {
        return {
            names: "orchestrator,preprocessing,ai-model,data-provider,backend,frontend,forwarder",
            commands: [
                "pnpm --filter orchestrator dev",
                "pnpm --filter preprocessing dev",
                "pnpm --filter ai-model dev",
                "pnpm --filter data-provider dev",
                "pnpm --filter webui-backend dev",
                "pnpm --filter vite-template dev",
                "pnpm --filter webui-forwarder dev"
            ]
        };
    }

    throw new Error(`未知 group: ${group}`);
}

async function main() {
    const args = parseArgs(process.argv);
    const group = args.group;
    if (!group) {
        console.error("用法: node scripts/launchDevGroup.cjs --group <all|backend|webui|forwarder|config>");
        process.exit(1);
    }

    const rootDir = path.resolve(__dirname, "..");

    // 1) 启动前命令（不等待其执行完成）
    await runPreStartCommand(rootDir);

    // 2) 启动多子项目（保持原有 concurrently 行为）
    const { names, commands } = buildConcurrentlyArgs(group);

    // Windows 下这里的 pnpm 通常是 pnpm.ps1（PowerShell 脚本），不能直接被 spawn 执行。
    // 因此统一通过 powershell -Command 调用，并确保每个 concurrently command 作为一个整体参数传入。
    const psQuote = value => {
        const s = String(value);
        return `'${s.replaceAll("'", "''")}'`;
    };

    const psCommand = `pnpm exec concurrently -n ${psQuote(names)} ${commands.map(psQuote).join(" ")}`;

    const child = spawn("powershell", ["-NoProfile", "-NonInteractive", "-Command", psCommand], {
        cwd: rootDir,
        stdio: "inherit",
        windowsHide: true
    });

    child.on("exit", code => {
        stopPreStartCommand("launcher-exit");
        process.exit(code ?? 0);
    });

    child.on("error", err => {
        stopPreStartCommand("launcher-error");
        console.error("启动 concurrently 失败:", err);
        process.exit(1);
    });
}

main().catch(err => {
    console.error(err?.stack || String(err));
    process.exit(1);
});
