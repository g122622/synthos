const path = require('path');
const { spawn, execSync } = require('child_process');

function parseArgs(argv) {
    const args = { watch: [], killPorts: [] };
    for (let i = 2; i < argv.length; i++) {
        const token = argv[i];
        if (token === '--name') args.name = argv[++i];
        else if (token === '--entry') args.entry = argv[++i];
        else if (token === '--watch') args.watch.push(argv[++i]);
        else if (token === '--debounce') args.debounce = Number(argv[++i]);
        else if (token === '--no-common') args.noCommon = true;
        else if (token === '--kill-port') args.killPorts.push(Number(argv[++i]));
    }
    return args;
}

function log(name, ...rest) {
    console.log(`[devRunner:${name}]`, ...rest);
}

function isDebugEnabled() {
    const v = String(process.env.DEV_RUNNER_DEBUG || '').trim();
    return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function debugLog(name, ...rest) {
    if (!isDebugEnabled()) return;
    console.log(`[devRunner:${name}:debug]`, ...rest);
}

function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
}

function formatExecError(err) {
    const parts = [];
    if (err && typeof err.status !== 'undefined') parts.push(`status=${err.status}`);
    if (err && typeof err.code !== 'undefined') parts.push(`code=${err.code}`);
    if (err && typeof err.signal !== 'undefined') parts.push(`signal=${err.signal}`);

    const stderr = err?.stderr ? err.stderr.toString('utf8').trim() : '';
    const stdout = err?.stdout ? err.stdout.toString('utf8').trim() : '';
    const msg = err?.message ? String(err.message).trim() : String(err).trim();

    const detail = stderr || stdout || msg;
    if (parts.length) return `${detail} (${parts.join(', ')})`;
    return detail;
}

function killTreeWin(pid, name) {
    // Avoid taskkill: some systems have required services disabled.
    // Recursively kill child processes, then the parent.
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
        // Use -EncodedCommand to avoid fragile Windows quoting rules
        const encoded = Buffer.from(script, 'utf16le').toString('base64');
        execSync(`powershell -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { stdio: ['ignore', 'pipe', 'pipe'] });
        return { ok: true, method: 'Stop-Process' };
    } catch (err) {
        const detail = formatExecError(err);
        // Keep default output clean; full details can be enabled via DEV_RUNNER_DEBUG=1
        debugLog(name, `Stop-Process failed pid=${pid}: ${detail}`);
        return { ok: false, msg: detail };
    }
}

function killPidWin(pid, name) {
    if (!pid || pid <= 0) return { ok: true, method: 'noop' };

    // 1) Prefer Node's kill for our own spawned child.
    try {
        process.kill(pid);
        return { ok: true, method: 'process.kill' };
    } catch {
        // fall through
    }

    // 2) Try taskkill (fast, kills tree). Some systems may have issues; treat as optional.
    try {
        execSync(`taskkill /PID ${pid} /T /F`, { stdio: ['ignore', 'pipe', 'pipe'] });
        return { ok: true, method: 'taskkill' };
    } catch {
        // fall through
    }

    // 3) Fallback to PowerShell.
    return killTreeWin(pid, name);
}

function isPidRunningWin(pid) {
    try {
        const raw = execSync(
            `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue) -ne $null"`,
            { stdio: ['ignore', 'pipe', 'ignore'] }
        )
            .toString('utf8')
            .trim()
            .toLowerCase();
        return raw === 'true';
    } catch {
        return false;
    }
}

async function waitForPidExitWin(pid, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (!isPidRunningWin(pid)) return true;
        await sleep(100);
    }
    return !isPidRunningWin(pid);
}

async function killTree(pid, name) {
    if (!pid) return;
    const isWin = process.platform === 'win32';

    let attempted = false;
    let killFailed = false;

    try {
        if (isWin) {
            attempted = true;
            const res = killPidWin(pid, name);
            if (!res?.ok) killFailed = true;
        } else {
            // kill process group
            attempted = true;
            process.kill(-pid, 'SIGTERM');
        }
    } catch (err) {
        killFailed = true;
        const msg = err?.message ? String(err.message) : String(err);
        log(name, `warning: failed to kill pid=${pid}: ${msg}`);
    }

    // give OS a moment to release ports
    await sleep(300);

    if (isWin && attempted) {
        // Give process.kill/taskkill a moment, then re-check.
        await sleep(300);
        const exited = await waitForPidExitWin(pid, 3000);
        if (!exited) {
            // This is a real issue (can cause stale instance serving). Keep as warning.
            log(name, `warning: pid still running after kill attempt pid=${pid}`);

            // Escalate: if initial attempt was process.kill/taskkill and it didn't work,
            // try the PowerShell tree kill once more.
            const res2 = killTreeWin(pid, name);
            if (!res2?.ok) {
                killFailed = true;
            }

            await sleep(300);
            const exited2 = await waitForPidExitWin(pid, 3000);
            if (!exited2) {
                log(name, `warning: pid still running after escalation pid=${pid}`);
            }
        }
    }

    if (attempted && !killFailed) {
        log(name, `killed previous pid=${pid}`);
        return;
    }

    if (!attempted) {
        log(name, `previous pid=${pid} already gone`);
        return;
    }

    // attempted but failed or still running
    log(name, `warning: kill may not have succeeded pid=${pid}`);
}

function uniqNumbers(values) {
    const seen = new Set();
    const out = [];
    for (const v of values) {
        const n = Number(v);
        if (!Number.isFinite(n)) continue;
        if (seen.has(n)) continue;
        seen.add(n);
        out.push(n);
    }
    return out;
}

function getListeningPidsByPortWin(port) {
    // 1) Prefer PowerShell (more structured)
    try {
        const cmd =
            'powershell -NoProfile -Command "' +
            `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue ` +
            `| Select-Object -ExpandProperty OwningProcess"`;
        const raw = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
        const pids = raw
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n) && n > 0);
        if (pids.length) return uniqNumbers(pids);
    } catch {
        // ignore and fall back
    }

    // 2) Fallback: netstat -ano
    try {
        const raw = execSync('netstat -ano -p tcp', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
        const lines = raw.split(/\r?\n/);
        const pids = [];
        for (const line of lines) {
            // Example:
            // TCP    0.0.0.0:7979     0.0.0.0:0      LISTENING       1234
            // TCP    [::]:7979        [::]:0         LISTENING       1234
            if (!/\bLISTENING\b/i.test(line)) continue;
            if (!line.includes(`:${port}`)) continue;
            const parts = line.trim().split(/\s+/);
            const pid = Number(parts[parts.length - 1]);
            if (Number.isFinite(pid) && pid > 0) pids.push(pid);
        }
        return uniqNumbers(pids);
    } catch {
        return [];
    }
}

function isPortListeningWin(port) {
    try {
        const cmd =
            'powershell -NoProfile -Command "' +
            `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue ` +
            `| Select-Object -First 1 -ExpandProperty OwningProcess"`;
        const raw = execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
        if (raw) return true;
    } catch {
        // ignore
    }

    try {
        const raw = execSync('netstat -ano -p tcp', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8');
        return raw.split(/\r?\n/).some((line) => /\bLISTENING\b/i.test(line) && line.includes(`:${port}`));
    } catch {
        return false;
    }
}

async function waitForPortsFreeWin(ports, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        let any = false;
        for (const port of ports) {
            if (isPortListeningWin(port)) {
                any = true;
                break;
            }
        }
        if (!any) return true;
        await sleep(100);
    }
    return false;
}

async function killByPorts(ports, name) {
    const list = uniqNumbers(ports).filter((p) => p > 0);
    if (!list.length) return { ok: true };

    const isWin = process.platform === 'win32';
    if (!isWin) return { ok: true };

    for (const port of list) {
        const pids = getListeningPidsByPortWin(port);
        for (const pid of pids) {
            if (pid === process.pid) continue;
            const res = killPidWin(pid, name);
            if (res?.ok) {
                log(name, `killed pid=${pid} on port=${port}`);
            } else {
                log(name, `warning: could not kill pid=${pid} on port=${port}`);
            }
        }
    }

    // Wait a bit for ports to actually become free (Windows can be racy)
    const ok = await waitForPortsFreeWin(list, 8000);
    if (!ok) {
        const details = list
            .map((p) => {
                const pids = getListeningPidsByPortWin(p);
                return `${p}=>[${pids.join(',')}]`;
            })
            .join(' ');
        log(name, `warning: ports still busy after cleanup: ${details}`);
        return { ok: false, busy: details };
    }

    return { ok: true };
}

function runBuild(cwd, name) {
    const opts = { cwd, stdio: 'inherit' };
    // Use pnpm to avoid npm env-config warnings when running under pnpm workspaces
    log(name, 'build: pnpm run build');
    execSync('pnpm -s run build', opts);

    log(name, 'postbuild: redirectRequire');
    execSync('node ../../scripts/redirectRequire.js', opts);

    log(name, 'postbuild: fixESMExtensions');
    execSync('node ../../scripts/fixESMExtensions.mjs', opts);
}

function startChild(entryRel, cwd, name) {
    const isWin = process.platform === 'win32';
    const child = spawn('node', [entryRel], {
        cwd,
        stdio: 'inherit',
        env: process.env,
        detached: !isWin,
    });

    log(name, `started pid=${child.pid} entry=${entryRel}`);
    child.on('exit', (code, signal) => {
        log(name, `child exit code=${code} signal=${signal}`);
    });
    return child;
}

async function main() {
    const args = parseArgs(process.argv);
    const name = args.name || path.basename(process.cwd());
    const cwd = process.cwd();
    const entry = args.entry || 'dist/index.js';
    const debounceMs = Number.isFinite(args.debounce) ? args.debounce : 800;

    const watchPaths = args.watch.length ? args.watch.slice() : ['src'];
    if (!args.noCommon) watchPaths.push('../../common');

    // de-dup while preserving order
    const seen = new Set();
    const deduped = [];
    for (const p of watchPaths) {
        const norm = String(p);
        if (seen.has(norm)) continue;
        seen.add(norm);
        deduped.push(norm);
    }

    let child = null;
    let building = false;
    let pending = false;
    let debounceTimer = null;

    const restart = async (reason) => {
        if (building) {
            pending = true;
            return;
        }

        building = true;
        pending = false;
        log(name, `restart begin (${reason})`);

        const oldPid = child?.pid;

        try {
            if (oldPid) await killTree(oldPid, name);
            runBuild(cwd, name);
            const portCheck = await killByPorts(args.killPorts, name);
            if (portCheck && portCheck.ok === false) {
                throw new Error(`Ports still busy after cleanup: ${portCheck.busy || ''}`);
            }
            child = startChild(entry, cwd, name);
        } catch (e) {
            log(name, 'restart failed; child not started');
            console.error(e?.stack || e);
        } finally {
            building = false;
            if (pending) {
                await restart('pending');
            }
        }
    };

    const shutdown = async () => {
        log(name, 'shutdown requested');
        if (child?.pid) await killTree(child.pid, name);
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // initial start
    await restart('initial');

    const chokidar = require('chokidar');
    log(name, `watching: ${deduped.join(', ')}`);

    const watcher = chokidar.watch(deduped, {
        cwd,
        ignoreInitial: true,
        awaitWriteFinish: {
            stabilityThreshold: 200,
            pollInterval: 50,
        },
    });

    const onChange = (file) => {
        log(name, `change: ${file}`);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => restart(`change:${file}`), debounceMs);
    };

    watcher.on('add', onChange);
    watcher.on('change', onChange);
    watcher.on('unlink', onChange);
}

main().catch((e) => {
    console.error(e?.stack || e);
    process.exit(1);
});
