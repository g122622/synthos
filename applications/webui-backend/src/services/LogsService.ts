import "reflect-metadata";

import * as fs from "fs/promises";
import * as path from "path";
import { injectable } from "tsyringe";

import ConfigManagerService from "@root/common/services/config/ConfigManagerService";
import Logger from "@root/common/util/Logger";

import { NotFoundError } from "../errors/AppError";

export type LogLevel = "debug" | "info" | "success" | "warning" | "error";

export interface LogItem {
    timestamp: number;
    level: LogLevel;
    raw: string;
    sourceFile: string;
}

export interface QueryLogsParams {
    limit: number;
    before?: number;
    startTime?: number;
    endTime?: number;
    levels?: LogLevel[];
}

export interface QueryLogsResult {
    items: LogItem[];
    nextBefore: number | null;
    hasMore: boolean;
}

interface LogFileInfo {
    fileName: string;
    dayStartMs: number;
}

@injectable()
export class LogsService {
    private readonly LOGGER = Logger.withTag("LogsService");

    public async queryLogs(params: QueryLogsParams): Promise<QueryLogsResult> {
        const config = await ConfigManagerService.getCurrentConfig();
        let logDirectory = config.logger.logDirectory;

        if (!path.isAbsolute(logDirectory)) {
            const configPath = await ConfigManagerService.getConfigPath();
            if (configPath) {
                logDirectory = path.join(path.dirname(configPath), logDirectory);
            }
        }

        await this._assertLogDirectoryExists(logDirectory);

        const upperBound = this._selectUpperBound(params);
        const files = await this._listLogFiles(logDirectory, params.startTime, upperBound);

        const items: LogItem[] = [];
        const levelsSet = params.levels ? new Set(params.levels) : null;

        for (const file of files) {
            const filePath = path.join(logDirectory, file.fileName);

            await this._readLinesFromEnd(filePath, async line => {
                const parsed = this._parseLogLine(line, file.fileName);
                if (!parsed) {
                    return true;
                }

                if (params.before !== undefined) {
                    if (!(parsed.timestamp < params.before)) {
                        return true;
                    }
                }

                if (params.startTime !== undefined) {
                    if (!(parsed.timestamp >= params.startTime)) {
                        return true;
                    }
                }

                if (params.endTime !== undefined) {
                    if (!(parsed.timestamp <= params.endTime)) {
                        return true;
                    }
                }

                if (levelsSet) {
                    if (!levelsSet.has(parsed.level)) {
                        return true;
                    }
                }

                items.push(parsed);

                if (items.length >= params.limit) {
                    return false;
                }

                return true;
            });

            if (items.length >= params.limit) {
                break;
            }
        }

        let nextBefore: number | null = null;
        if (items.length > 0) {
            const oldest = items[items.length - 1];
            nextBefore = Math.max(0, oldest.timestamp - 1);
        }

        return {
            // items 是按“从新到旧”追加的（因为我们是从文件末尾向前读）
            items,
            nextBefore,
            hasMore: items.length >= params.limit
        };
    }

    private _selectUpperBound(params: QueryLogsParams): number | undefined {
        if (params.endTime !== undefined) {
            return params.endTime;
        }

        if (params.before !== undefined) {
            return params.before;
        }

        return undefined;
    }

    private async _assertLogDirectoryExists(logDirectory: string): Promise<void> {
        try {
            const stat = await fs.stat(logDirectory);
            if (!stat.isDirectory()) {
                throw new NotFoundError(`日志目录不是文件夹: ${logDirectory}`);
            }
        } catch {
            throw new NotFoundError(`日志目录不存在: ${logDirectory}`);
        }
    }

    private _getDayStartMs(timestamp: number): number {
        const d = new Date(timestamp);
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    }

    private async _listLogFiles(
        logDirectory: string,
        startTime?: number,
        upperBound?: number
    ): Promise<LogFileInfo[]> {
        const startDay = startTime !== undefined ? this._getDayStartMs(startTime) : undefined;
        const upperDay = upperBound !== undefined ? this._getDayStartMs(upperBound) : undefined;

        const dirents = await fs.readdir(logDirectory, { withFileTypes: true });
        const results: LogFileInfo[] = [];

        for (const d of dirents) {
            if (!d.isFile()) {
                continue;
            }

            const fileName = d.name;
            if (!fileName.endsWith(".log")) {
                continue;
            }

            const dayStartMs = this._parseDayStartMsFromFileName(fileName);
            if (dayStartMs === null) {
                continue;
            }

            if (startDay !== undefined) {
                if (dayStartMs < startDay) {
                    continue;
                }
            }

            if (upperDay !== undefined) {
                if (dayStartMs > upperDay) {
                    continue;
                }
            }

            results.push({ fileName, dayStartMs });
        }

        results.sort((a, b) => b.dayStartMs - a.dayStartMs);
        return results;
    }

    private _parseDayStartMsFromFileName(fileName: string): number | null {
        // 期望格式：YYYY-MM-DD.log
        if (fileName.length !== 14) {
            return null;
        }

        const datePart = fileName.slice(0, 10);
        const dateParts = datePart.split("-");
        if (dateParts.length !== 3) {
            return null;
        }

        const year = Number.parseInt(dateParts[0], 10);
        const month = Number.parseInt(dateParts[1], 10);
        const day = Number.parseInt(dateParts[2], 10);

        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
            return null;
        }

        const ms = new Date(`${dateParts[0]}-${dateParts[1]}-${dateParts[2]}T00:00:00`).getTime();
        if (!Number.isFinite(ms)) {
            return null;
        }

        return ms;
    }

    private _parseLogLine(line: string, sourceFile: string): LogItem | null {
        const timestampMs = this._extractTimestampMs(line);
        if (timestampMs === null) {
            return null;
        }

        const level = this._extractLevel(line);
        if (!level) {
            return null;
        }

        return {
            timestamp: timestampMs,
            level,
            raw: line,
            sourceFile
        };
    }

    private _extractTimestampMs(line: string): number | null {
        const left = line.indexOf("[");
        if (left === -1) {
            return null;
        }

        const right = line.indexOf("]", left + 1);
        if (right === -1) {
            return null;
        }

        const inside = line.slice(left + 1, right);
        const parts = inside.split(" ");
        if (parts.length !== 2) {
            return null;
        }

        const iso = `${parts[0]}T${parts[1]}`;
        const ms = new Date(iso).getTime();
        if (!Number.isFinite(ms)) {
            return null;
        }

        return ms;
    }

    private _extractLevel(line: string): LogLevel | null {
        const firstRight = line.indexOf("]");
        if (firstRight === -1) {
            return null;
        }

        const secondLeft = line.indexOf("[", firstRight + 1);
        if (secondLeft === -1) {
            return null;
        }

        const secondRight = line.indexOf("]", secondLeft + 1);
        if (secondRight === -1) {
            return null;
        }

        const levelUpper = line
            .slice(secondLeft + 1, secondRight)
            .trim()
            .toUpperCase();
        if (levelUpper === "DEBUG") return "debug";
        if (levelUpper === "INFO") return "info";
        if (levelUpper === "SUCCESS") return "success";
        if (levelUpper === "WARNING") return "warning";
        if (levelUpper === "ERROR") return "error";
        return null;
    }

    private async _readLinesFromEnd(
        filePath: string,
        onLine: (line: string) => Promise<boolean> | boolean
    ): Promise<void> {
        const handle = await fs.open(filePath, "r");

        try {
            const stat = await handle.stat();
            const chunkSize = 64 * 1024;
            let position = stat.size;
            let carry = "";

            while (position > 0) {
                const readSize = Math.min(chunkSize, position);
                position -= readSize;

                const buffer = Buffer.alloc(readSize);
                await handle.read(buffer, 0, readSize, position);

                const chunkText = buffer.toString("utf8");
                const text = chunkText + carry;
                const parts = text.split("\n");

                carry = parts[0] || "";

                for (let idx = parts.length - 1; idx >= 1; idx--) {
                    let line = parts[idx];
                    if (line.endsWith("\r")) {
                        line = line.slice(0, -1);
                    }

                    if (line.length === 0) {
                        continue;
                    }

                    const shouldContinue = await onLine(line);
                    if (shouldContinue === false) {
                        return;
                    }
                }
            }

            if (carry.length > 0) {
                let lastLine = carry;
                if (lastLine.endsWith("\r")) {
                    lastLine = lastLine.slice(0, -1);
                }

                if (lastLine.length > 0) {
                    await onLine(lastLine);
                }
            }
        } catch (error) {
            this.LOGGER.error(`读取日志文件失败: ${filePath}, error=${String(error)}`);
            throw error;
        } finally {
            await handle.close();
        }
    }
}
