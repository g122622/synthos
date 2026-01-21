import "reflect-metadata";
import { inject, injectable } from "tsyringe";
import { join } from "path";
import Logger from "@root/common/util/Logger";
import { KVStore } from "@root/common/util/KVStore";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

/**
 * 变量条目元信息
 */
export interface VariableMeta {
    /** 变量 key */
    key: string;
    /** 摘要（用于提示词目录展示） */
    summary: string;
    /** 创建时间（毫秒时间戳） */
    createdAt: number;
    /** 更新时间（毫秒时间戳） */
    updatedAt: number;
}

/**
 * 变量条目（存储在 KV 中）
 */
export interface VariableEntry {
    /** 变量 key */
    key: string;
    /** 变量值（必须可 JSON 序列化） */
    value: unknown;
    /** 摘要（用于提示词目录展示） */
    summary: string;
    /** 创建时间（毫秒时间戳） */
    createdAt: number;
    /** 更新时间（毫秒时间戳） */
    updatedAt: number;
}

interface VariableIndex {
    /** key -> meta */
    items: Record<string, VariableMeta>;
}

/**
 * Agent 变量空间服务
 *
 * 目标：提供一个“统一变量空间”，让 Agent 在多轮工具调用/推理中把中间结果以可检索的 key 形式保存下来。
 *
 * 设计约束：
 * - 不依赖 KVStore 的遍历能力（KVStore 当前仅支持 get/put/del/batch）
 * - 因此维护一个 per-session 的 index（key -> meta），用于 var_list
 */
@injectable()
@mustInitBeforeUse
export class VariableSpaceService extends Disposable {
    private LOGGER = Logger.withTag("VariableSpaceService");

    private store: KVStore<unknown> | null = null;

    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
    }

    /**
     * 初始化变量空间
     */
    public async init(): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();

        // 复用全局配置中的 kvStoreBasePath，不新增配置项，避免影响现有链路
        const basePath = config.webUI_Backend.kvStoreBasePath;
        const location = join(basePath, "agent-variable-space");

        this.store = new KVStore(location);
        this._registerDisposableFunction(() => this.store!.dispose());

        this.LOGGER.success(`变量空间初始化完成，路径: ${location}`);
    }

    /**
     * 写入变量
     * @param sessionId 会话 ID
     * @param key 变量 key
     * @param value 变量值（JSON 可序列化）
     * @param summary 摘要（用于目录展示）
     */
    public async set(sessionId: string, key: string, value: unknown, summary: string): Promise<VariableEntry> {
        this._ensureReady();
        this._assertNonEmpty(sessionId, "sessionId");
        this._assertNonEmpty(key, "key");

        const now = Date.now();
        const entryKey = this._buildEntryKey(sessionId, key);
        const indexKey = this._buildIndexKey(sessionId);

        const existing = (await this.store!.get(entryKey)) as VariableEntry | undefined;

        const createdAt = existing ? existing.createdAt : now;
        const entry: VariableEntry = {
            key,
            value,
            summary,
            createdAt,
            updatedAt: now
        };

        const index = await this._getIndex(sessionId);
        index.items[key] = {
            key,
            summary,
            createdAt,
            updatedAt: now
        };

        await this.store!.batch([
            { type: "put", key: entryKey, value: entry },
            { type: "put", key: indexKey, value: index }
        ]);

        return entry;
    }

    /**
     * 读取变量（不存在则抛错）
     */
    public async get(sessionId: string, key: string): Promise<VariableEntry> {
        this._ensureReady();
        this._assertNonEmpty(sessionId, "sessionId");
        this._assertNonEmpty(key, "key");

        const entryKey = this._buildEntryKey(sessionId, key);
        const entry = (await this.store!.get(entryKey)) as VariableEntry | undefined;
        if (!entry) {
            throw new Error(`变量不存在: ${key}`);
        }
        return entry;
    }

    /**
     * 列出变量目录
     */
    public async list(sessionId: string, prefix: string | undefined, limit: number): Promise<VariableMeta[]> {
        this._ensureReady();
        this._assertNonEmpty(sessionId, "sessionId");

        const index = await this._getIndex(sessionId);
        const allKeys = Object.keys(index.items);

        const filtered: VariableMeta[] = [];
        for (const key of allKeys) {
            if (prefix && prefix.length > 0) {
                if (!key.startsWith(prefix)) {
                    continue;
                }
            }

            filtered.push(index.items[key]);
        }

        filtered.sort((a, b) => b.updatedAt - a.updatedAt);

        if (filtered.length > limit) {
            filtered.splice(limit);
        }

        return filtered;
    }

    /**
     * 删除变量（不存在则抛错）
     */
    public async delete(sessionId: string, key: string): Promise<void> {
        this._ensureReady();
        this._assertNonEmpty(sessionId, "sessionId");
        this._assertNonEmpty(key, "key");

        const index = await this._getIndex(sessionId);
        if (!index.items[key]) {
            throw new Error(`变量不存在: ${key}`);
        }

        delete index.items[key];

        await this.store!.batch([
            { type: "del", key: this._buildEntryKey(sessionId, key) },
            { type: "put", key: this._buildIndexKey(sessionId), value: index }
        ]);
    }

    /**
     * 生成用于 system prompt 展示的“变量目录快照”（只包含 key+summary，不泄露全量内容）
     */
    public async buildDirectoryForPrompt(sessionId: string, limit: number): Promise<string> {
        this._ensureReady();
        this._assertNonEmpty(sessionId, "sessionId");

        const metas = await this.list(sessionId, undefined, limit);
        if (metas.length === 0) {
            return "变量空间为空（可使用 var_set 写入中间结果）";
        }

        let text = "以下是当前会话的变量空间目录（仅展示摘要；需要内容请使用 var_get）：\n";
        for (const meta of metas) {
            text += `- ${meta.key}: ${meta.summary}\n`;
        }
        return text;
    }

    private async _getIndex(sessionId: string): Promise<VariableIndex> {
        const indexKey = this._buildIndexKey(sessionId);
        const index = (await this.store!.get(indexKey)) as VariableIndex | undefined;
        if (index) {
            if (index.items) {
                return index;
            }
        }
        return { items: {} };
    }

    private _buildEntryKey(sessionId: string, key: string): string {
        return `agent:vars:${sessionId}:${key}`;
    }

    private _buildIndexKey(sessionId: string): string {
        return `agent:vars:index:${sessionId}`;
    }

    private _ensureReady(): void {
        if (!this.store) {
            throw new Error("VariableSpaceService 未初始化");
        }
    }

    private _assertNonEmpty(value: string, fieldName: string): void {
        if (!value || value.trim().length === 0) {
            throw new Error(`${fieldName} 不能为空`);
        }
    }
}
