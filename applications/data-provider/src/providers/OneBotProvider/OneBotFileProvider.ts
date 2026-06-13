import "reflect-metadata";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { injectable, inject } from "tsyringe";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { DownloadedGroupFile, GroupFileInfo } from "@root/common/contracts/data-provider/index";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

import { COMMON_TOKENS } from "../../di/tokens";
import { IGroupFileProvider } from "../contracts/IGroupFileProvider";

interface OneBotConfig {
    enabled: boolean;
    baseURL: string;
    accessToken: string;
    downloadDirectory: string;
    requestTimeoutMs: number;
}

interface OneBotResponse<T> {
    status?: string;
    retcode?: number;
    data?: T;
    message?: string;
    wording?: string;
}

type OneBotFileRaw = Record<string, unknown>;

/**
 * OneBot/NapCat 群文件 Provider
 * 负责通过 OneBot HTTP API 列出群文件、获取下载链接并下载到本地。
 */
@injectable()
@mustInitBeforeUse
export class OneBotFileProvider extends Disposable implements IGroupFileProvider {
    private LOGGER = Logger.withTag("OneBotFileProvider");
    private config: OneBotConfig | null = null;

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
    }

    /**
     * 初始化 OneBot 文件 Provider
     */
    public async init(): Promise<void> {
        const config = (await this.configManagerService.getCurrentConfig()).dataProviders.OneBot;

        if (!config || !config.enabled) {
            throw new Error("OneBot/NapCat 文件 Provider 未启用");
        }

        this.config = {
            enabled: config.enabled,
            baseURL: this._trimTrailingSlashes(config.baseURL),
            accessToken: config.accessToken,
            downloadDirectory: config.downloadDirectory,
            requestTimeoutMs: config.requestTimeoutMs
        };

        await mkdir(this.config.downloadDirectory, { recursive: true });
        this.LOGGER.success("初始化完成！");
    }

    /**
     * 列出指定群的根目录文件
     * @param groupId 群号
     * @returns 群文件列表
     */
    public async listGroupFiles(groupId: string): Promise<GroupFileInfo[]> {
        const actions = ["get_group_root_files", "get_group_file_list", "get_group_files"];

        for (const action of actions) {
            try {
                const result = await this._callAction<unknown>(action, {
                    group_id: this._toOneBotGroupId(groupId)
                });
                const files = this._extractFiles(result).map(file => this._normalizeGroupFile(groupId, file));

                this.LOGGER.info(`群 ${groupId} 通过 ${action} 获取到 ${files.length} 个文件`);

                return files;
            } catch (error) {
                this.LOGGER.warning(`调用 ${action} 获取群 ${groupId} 文件列表失败: ${error}`);
            }
        }

        throw new Error(`无法获取群 ${groupId} 的文件列表`);
    }

    /**
     * 获取群文件下载链接
     * @param groupId 群号
     * @param fileId 文件 ID
     * @param busid 文件业务 ID
     * @returns 临时下载链接
     */
    public async getGroupFileDownloadUrl(groupId: string, fileId: string, busid?: number): Promise<string> {
        const actions = ["get_group_file_url", "get_file_url"];

        for (const action of actions) {
            try {
                const result = await this._callAction<Record<string, unknown>>(action, {
                    group_id: this._toOneBotGroupId(groupId),
                    group: groupId,
                    file_id: fileId,
                    file: fileId,
                    busid
                });
                const url = this._pickString(result, [
                    "url",
                    "download_url",
                    "downloadUrl",
                    "file_url",
                    "fileUrl"
                ]);

                if (url) {
                    return url;
                }
            } catch (error) {
                this.LOGGER.warning(`调用 ${action} 获取文件 ${fileId} 下载链接失败: ${error}`);
            }
        }

        throw new Error(`无法获取群 ${groupId} 文件 ${fileId} 的下载链接`);
    }

    /**
     * 下载群文件到配置目录
     * @param groupId 群号
     * @param fileId 文件 ID
     * @param fileName 文件名；不传时会用 fileId 作为文件名
     * @param busid 文件业务 ID
     * @returns 下载结果
     */
    public async downloadGroupFile(
        groupId: string,
        fileId: string,
        fileName?: string,
        busid?: number
    ): Promise<DownloadedGroupFile> {
        if (!this.config) {
            throw new Error("OneBot/NapCat 文件 Provider 未初始化");
        }

        const url = await this.getGroupFileDownloadUrl(groupId, fileId, busid);
        const response = await this._fetch(url, {
            method: "GET"
        });

        if (!response.ok) {
            throw new Error(`下载文件失败，HTTP 状态码: ${response.status}`);
        }

        const buffer = Buffer.from(await response.arrayBuffer());
        const safeFileName = this._sanitizeFileName(fileName || fileId);
        const groupDirectory = path.join(this.config.downloadDirectory, groupId);
        const localPath = path.join(groupDirectory, safeFileName);

        await mkdir(groupDirectory, { recursive: true });
        await writeFile(localPath, buffer);

        return {
            fileInfo: {
                groupId,
                fileId,
                fileName: safeFileName,
                fileSize: buffer.length,
                busid
            },
            localPath,
            sizeBytes: buffer.length
        };
    }

    private async _callAction<T>(action: string, params: Record<string, unknown>): Promise<T> {
        if (!this.config) {
            throw new Error("OneBot/NapCat 文件 Provider 未初始化");
        }

        const response = await this._fetch(`${this.config.baseURL}/${action}`, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                ...this._buildAuthHeaders()
            },
            body: JSON.stringify(this._dropUndefinedValues(params))
        });

        if (!response.ok) {
            throw new Error(`OneBot API ${action} HTTP 状态码异常: ${response.status}`);
        }

        const body = (await response.json()) as OneBotResponse<T> | T;

        if (this._isWrappedOneBotResponse<T>(body)) {
            if (body.status && body.status !== "ok") {
                throw new Error(body.wording || body.message || `OneBot API ${action} 调用失败`);
            }

            if (typeof body.retcode === "number" && body.retcode !== 0) {
                throw new Error(
                    body.wording || body.message || `OneBot API ${action} 返回 retcode=${body.retcode}`
                );
            }

            return body.data as T;
        }

        return body as T;
    }

    private async _fetch(url: string, init: RequestInit): Promise<Response> {
        if (!this.config) {
            throw new Error("OneBot/NapCat 文件 Provider 未初始化");
        }

        const abortController = new AbortController();
        const timeout = setTimeout(() => abortController.abort(), this.config.requestTimeoutMs);

        try {
            return await fetch(url, {
                ...init,
                signal: abortController.signal
            });
        } finally {
            clearTimeout(timeout);
        }
    }

    private _buildAuthHeaders(): Record<string, string> {
        if (!this.config || !this.config.accessToken) {
            return {};
        }

        return {
            authorization: `Bearer ${this.config.accessToken}`
        };
    }

    private _extractFiles(result: unknown): OneBotFileRaw[] {
        if (Array.isArray(result)) {
            return result.filter(item => typeof item === "object" && item !== null) as OneBotFileRaw[];
        }

        if (typeof result !== "object" || result === null) {
            return [];
        }

        const record = result as Record<string, unknown>;
        const candidates = [record.files, record.file_list, record.fileList, record.items];

        for (const candidate of candidates) {
            if (Array.isArray(candidate)) {
                return candidate.filter(item => typeof item === "object" && item !== null) as OneBotFileRaw[];
            }
        }

        return [];
    }

    private _normalizeGroupFile(groupId: string, raw: OneBotFileRaw): GroupFileInfo {
        const fileId = this._pickString(raw, ["file_id", "fileId", "id"]);
        const fileName = this._pickString(raw, ["file_name", "fileName", "name"]);
        const folderId = this._pickString(raw, ["folder_id", "folderId", "parent_folder_id", "parentFolderId"]);
        const fileSize = this._pickNumber(raw, ["file_size", "fileSize", "size"]);
        const uploadTime = this._pickOptionalTime(raw, ["upload_time", "uploadTime", "uploaded_at", "uploadedAt"]);
        const busid = this._pickOptionalNumber(raw, ["busid", "bus_id", "busId"]);

        if (!fileId) {
            throw new Error(`群 ${groupId} 文件缺少 file_id`);
        }

        if (!fileName) {
            throw new Error(`群 ${groupId} 文件 ${fileId} 缺少文件名`);
        }

        return {
            groupId,
            fileId,
            fileName,
            fileSize,
            uploadTime,
            busid,
            folderId
        };
    }

    private _pickString(record: Record<string, unknown>, keys: string[]): string {
        for (const key of keys) {
            const value = record[key];

            if (typeof value === "string" && value.length > 0) {
                return value;
            }

            if (typeof value === "number") {
                return String(value);
            }
        }

        return "";
    }

    private _pickNumber(record: Record<string, unknown>, keys: string[]): number {
        const result = this._pickOptionalNumber(record, keys);

        return result ?? 0;
    }

    private _pickOptionalNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
        for (const key of keys) {
            const value = record[key];

            if (typeof value === "number") {
                return value;
            }

            if (typeof value === "string" && value.length > 0) {
                const parsed = Number(value);

                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
        }

        return undefined;
    }

    private _pickOptionalTime(record: Record<string, unknown>, keys: string[]): number | undefined {
        const value = this._pickOptionalNumber(record, keys);

        if (value === undefined) {
            return undefined;
        }

        if (value < 10_000_000_000) {
            return value * 1000;
        }

        return value;
    }

    private _toOneBotGroupId(groupId: string): string | number {
        const parsed = Number(groupId);

        if (Number.isSafeInteger(parsed)) {
            return parsed;
        }

        return groupId;
    }

    private _sanitizeFileName(fileName: string): string {
        const forbiddenChars = new Set(["/", "\\", ":", "*", "?", '"', "<", ">", "|"]);
        let result = "";

        for (const char of fileName) {
            if (forbiddenChars.has(char)) {
                result += "_";
            } else {
                result += char;
            }
        }

        const trimmed = result.trim();

        return trimmed || "unnamed-file";
    }

    private _dropUndefinedValues(params: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};

        for (const key of Object.keys(params)) {
            const value = params[key];

            if (value !== undefined) {
                result[key] = value;
            }
        }

        return result;
    }

    private _trimTrailingSlashes(value: string): string {
        let endIndex = value.length;

        while (endIndex > 0 && value[endIndex - 1] === "/") {
            endIndex--;
        }

        return value.slice(0, endIndex);
    }

    private _isWrappedOneBotResponse<T>(body: OneBotResponse<T> | T): body is OneBotResponse<T> {
        return (
            typeof body === "object" && body !== null && ("status" in body || "retcode" in body || "data" in body)
        );
    }
}
