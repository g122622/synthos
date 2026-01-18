const path = require("path");
const { spawn } = require("child_process");
const { execSync } = require("child_process");
const fs = require("fs");

function log(...args) {
    console.log("[preStartCommand]", ...args);
}

function warn(...args) {
    console.warn("[preStartCommand]", ...args);
}

function isTruthy(value) {
    const v = String(value ?? "").trim().toLowerCase();
    return v === "1" || v === "true" || v === "yes";
}

function isDebugEnabled() {
    return isTruthy(process.env.PRE_START_COMMAND_DEBUG);
}

function debugLog(...args) {
    if (!isDebugEnabled()) {
        return;
    }
    console.log("[preStartCommand:debug]", ...args);
}

let _trackedChild = null;
let _shutdownHookInstalled = false;

function _formatExecError(error) {
    const stderr = error?.stderr ? error.stderr.toString("utf8").trim() : "";
    const stdout = error?.stdout ? error.stdout.toString("utf8").trim() : "";
    const msg = error?.message ? String(error.message).trim() : String(error).trim();
    return stderr || stdout || msg;
}

function _killTreeWin(pid) {
    if (!pid || pid <= 0) {
        return;
    }

    // 1) Try taskkill first (fast and kills tree)
    try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: ["ignore", "pipe", "pipe"] });
        return;
    } catch (error) {
        debugLog("taskkill failed:", _formatExecError(error));
    }

    // 2) Fallback: PowerShell recursive kill
    const script = `$ErrorActionPreference = 'SilentlyContinue'
function Kill-Tree([int]$Pid) {
  if ($Pid -le 0) { return }
  try {
    $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$Pid" -ErrorAction SilentlyContinue | Select-Object -ExpandProperty ProcessId
    foreach ($c in $children) { Kill-Tree -Pid $c }
  } catch { }
  try { Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue } catch { }
}
Kill-Tree -Pid ${pid}
exit 0
`;

    try {
        const encoded = Buffer.from(script, "utf16le").toString("base64");
        execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, {
            stdio: ["ignore", "pipe", "pipe"]
        });
    } catch (error) {
        debugLog("powershell kill-tree failed:", _formatExecError(error));
    }
}

function _killProcessTree(pid) {
    if (!pid || pid <= 0) {
        return;
    }

    if (process.platform === "win32") {
        _killTreeWin(pid);
        return;
    }

    try {
        process.kill(pid, "SIGTERM");
    } catch {
        // ignore
    }
}

function _installShutdownHook() {
    if (_shutdownHookInstalled) {
        return;
    }
    _shutdownHookInstalled = true;

    const handler = (reason) => {
        if (_trackedChild?.pid) {
            debugLog(`shutdown hook: killing preStartCommand pid=${_trackedChild.pid}, reason=${reason}`);
            _killProcessTree(_trackedChild.pid);
        }
    };

    process.once("SIGINT", () => handler("SIGINT"));
    process.once("SIGTERM", () => handler("SIGTERM"));
    process.once("exit", () => handler("exit"));
}

function stopPreStartCommand(reason) {
    if (_trackedChild?.pid) {
        log(`结束启动前命令进程树 pid=${_trackedChild.pid} reason=${reason || "unknown"}`);
        _killProcessTree(_trackedChild.pid);
        _trackedChild = null;
    }
}

function _readJsonFileIfExists(filePath) {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        const raw = fs.readFileSync(filePath, "utf8");
        return JSON.parse(raw);
    } catch (error) {
        warn(`读取或解析 JSON 失败: ${filePath}`);
        warn(error?.stack || String(error));
        return null;
    }
}

function _deepMerge(target, source) {
    if (!source || typeof source !== "object" || Array.isArray(source)) {
        return target;
    }

    const result = { ...(target || {}) };
    for (const key of Object.keys(source)) {
        const sourceValue = source[key];
        if (typeof sourceValue === "undefined") {
            continue;
        }

        const targetValue = target ? target[key] : undefined;
        if (
            sourceValue !== null &&
            typeof sourceValue === "object" &&
            !Array.isArray(sourceValue) &&
            targetValue !== null &&
            typeof targetValue === "object" &&
            !Array.isArray(targetValue)
        ) {
            result[key] = _deepMerge(targetValue, sourceValue);
        } else {
            result[key] = sourceValue;
        }
    }

    return result;
}

function _resolveConfigPath(rootDir) {
    if (process.env.SYNTHOS_CONFIG_PATH) {
        return String(process.env.SYNTHOS_CONFIG_PATH);
    }
    return path.join(rootDir, "synthos_config.json");
}

function _loadMergedConfig(rootDir) {
    const configPath = _resolveConfigPath(rootDir);
    const baseConfig = _readJsonFileIfExists(configPath);
    if (!baseConfig) {
        throw new Error(`未找到或无法读取配置文件: ${configPath}`);
    }

    const overridePath = path.join(path.dirname(configPath), "synthos_config_override.json");
    const overrideConfig = _readJsonFileIfExists(overridePath) || {};
    return _deepMerge(baseConfig, overrideConfig);
}

function _spawnShellCommand(command, options) {
    const child = spawn(command, {
        cwd: options.cwd,
        env: process.env,
        shell: true,
        detached: options.detached,
        stdio: options.silent ? "ignore" : "inherit",
        windowsHide: true
    });

    if (options.detached) {
        child.unref();
    }

    return child;
}

/**
 * 在启动全部子项目之前执行一次“启动前命令”。
 * - 使用独立子进程执行
 * - 不等待命令执行完成
 */
async function runPreStartCommand(rootDir) {
    try {
        const config = _loadMergedConfig(rootDir);
        const preStartCommand = config.preStartCommand;

        if (!preStartCommand) {
            debugLog("preStartCommand missing");
            return;
        }

        if (!preStartCommand.enabled) {
            debugLog("disabled");
            return;
        }

        const command = String(preStartCommand.command ?? "").trim();
        if (!command) {
            warn("启动前命令已启用，但 command 为空，已跳过");
            return;
        }

        const silent = Boolean(preStartCommand.silent);
        const detached = Boolean(preStartCommand.detached);

        if (silent && !isDebugEnabled()) {
            log("执行启动前命令（silent=true）");
        } else {
            log(`执行启动前命令: ${command}`);
        }
        const child = _spawnShellCommand(command, { cwd: rootDir, silent, detached });
        debugLog(`spawned pid=${child.pid} detached=${detached} silent=${silent}`);

        if (!detached) {
            _trackedChild = child;
            _installShutdownHook();

            child.on("exit", (code, signal) => {
                debugLog(`preStartCommand child exit code=${code} signal=${signal}`);
                if (_trackedChild === child) {
                    _trackedChild = null;
                }
            });
        }
    } catch (error) {
        // 不要阻塞主启动流程；仅提示。
        warn("执行启动前命令失败（已忽略，不影响主启动）:");
        warn(error?.stack || String(error));
    }
}

module.exports = {
    runPreStartCommand,
    stopPreStartCommand
};
