/**
 * VectorDBManager
 * 基于 better-sqlite3 + sqlite-vec 的向量数据库管理器
 * 使用单独的固定数据库文件存储向量
 */
import "reflect-metadata";
import Database from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import { mkdir } from "fs/promises";
import { dirname } from "path";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";

@mustInitBeforeUse
export class VectorDBManager extends Disposable {
    private db: Database.Database | null = null;
    private dbPath: string;
    private dimension: number;
    private LOGGER = Logger.withTag("VectorDBManager");

    /**
     * @param dbPath 向量数据库文件路径
     * @param dimension 向量维度，bge-m3 为 1024
     */
    constructor(dbPath: string, dimension: number) {
        super();
        this.dbPath = dbPath;
        this.dimension = dimension;
    }

    public async init(): Promise<void> {
        // 确保目录存在
        await mkdir(dirname(this.dbPath), { recursive: true });
        // 打开数据库
        this.db = new Database(this.dbPath);
        // 注册释放函数
        this._registerDisposableFunction(() => {
            if (this.db) {
                this.db.close();
                this.LOGGER.info("数据库连接已关闭");
            }
        });
        // 加载 sqlite-vec 扩展
        sqliteVec.load(this.db);
        // 优化数据库性能
        this.optimizeDatabasePerformance();
        // 创建表结构
        this.createTables();
        // 预热索引
        await this.warmupIndex();

        this.LOGGER.success("数据库初始化完成");
    }

    private createTables(): void {
        // topicId 映射表（因为 vec0 只支持 rowid 作为主键）
        this.db!.exec(`
            CREATE TABLE IF NOT EXISTS topic_vector_mapping (
                topic_id TEXT PRIMARY KEY,
                vector_rowid INTEGER UNIQUE,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            );
        `);

        // 向量索引表（由 sqlite-vec 管理）
        // 注意：vec0 虚拟表的 rowid 与普通表的 rowid 对应
        this.db!.exec(`
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_topics USING vec0(
                embedding FLOAT[${this.dimension}]
            );
        `);

        this.LOGGER.info("表结构创建/验证完成");
    }

    private optimizeDatabasePerformance(): void {
        // 启用内存映射，大幅提升性能
        this.db!.pragma("mmap_size = 1024000000"); // 1GB

        // 启用WAL模式，提高并发性能
        this.db!.pragma("journal_mode = WAL");

        // 缓存大小
        this.db!.pragma("cache_size = -200000"); // 200MB

        // 同步模式优化
        this.db!.pragma("synchronous = NORMAL");

        this.LOGGER.success("数据库性能优化配置已应用");
    }

    async warmupIndex(): Promise<void> {
        if (this.getCount() === 0) return;

        // 创建一个随机查询向量进行预热
        const dummyVector = new Float32Array(this.dimension);
        for (let i = 0; i < this.dimension; i++) {
            dummyVector[i] = Math.random();
        }

        // 执行一个简单的搜索来预热索引
        this.searchSimilar(dummyVector, [], 1);
        this.LOGGER.info("向量索引预热完成");
    }

    // ========== 写入操作 ==========

    /**
     * 存储单个 topic 的嵌入向量
     * @param topicId 话题ID（主键）
     * @param embedding 向量数据
     */
    public storeEmbedding(topicId: string, embedding: Float32Array): void {
        if (embedding.length !== this.dimension) {
            throw new Error(`向量维度不匹配：期望 ${this.dimension}，实际 ${embedding.length}`);
        }

        // 使用事务确保原子性
        const transaction = this.db!.transaction(() => {
            // 1. 插入向量到 vec_topics，获取 rowid
            const insertVec = this.db!.prepare(`
                INSERT INTO vec_topics (embedding) VALUES (?)
            `);
            const result = insertVec.run(embedding);
            const vectorRowid = result.lastInsertRowid;

            // 2. 插入映射关系到 topic_vector_mapping
            const insertMapping = this.db!.prepare(`
                INSERT OR REPLACE INTO topic_vector_mapping (topic_id, vector_rowid) VALUES (?, ?)
            `);
            insertMapping.run(topicId, vectorRowid);
        });

        transaction();
    }

    /**
     * 批量存储嵌入向量
     * @param items 包含 topicId 和 embedding 的数组
     */
    public storeEmbeddings(items: Array<{ topicId: string; embedding: Float32Array }>): void {
        if (items.length === 0) {
            return;
        }

        const insertVec = this.db!.prepare(`
            INSERT INTO vec_topics (embedding) VALUES (?)
        `);
        const insertMapping = this.db!.prepare(`
            INSERT OR REPLACE INTO topic_vector_mapping (topic_id, vector_rowid) VALUES (?, ?)
        `);

        const transaction = this.db!.transaction(() => {
            for (const item of items) {
                if (item.embedding.length !== this.dimension) {
                    throw new Error(
                        `向量维度不匹配：期望 ${this.dimension}，实际 ${item.embedding.length}，topicId: ${item.topicId}`
                    );
                }

                const result = insertVec.run(item.embedding);
                const vectorRowid = result.lastInsertRowid;
                insertMapping.run(item.topicId, vectorRowid);
            }
        });

        transaction();
        this.LOGGER.info(`批量存储完成，共 ${items.length} 条向量`);
    }

    // ========== 查询操作 ==========

    /**
     * 检查 topicId 是否已有嵌入向量
     * @param topicId 话题ID
     * @returns boolean
     */
    public hasEmbedding(topicId: string): boolean {
        const stmt = this.db!.prepare(`
            SELECT 1 FROM topic_vector_mapping WHERE topic_id = ?
        `);
        const result = stmt.get(topicId);
        return result !== undefined;
    }

    /**
     * 过滤出未生成嵌入的 topicId 列表
     * @param topicIds 待检查的 topicId 数组
     * @returns 不存在嵌入的 topicId 数组
     */
    public filterWithoutEmbedding(topicIds: string[]): string[] {
        if (topicIds.length === 0) {
            return [];
        }

        // 批量查询已存在的 topicId
        const placeholders = topicIds.map(() => "?").join(",");
        const stmt = this.db!.prepare(`
            SELECT topic_id FROM topic_vector_mapping WHERE topic_id IN (${placeholders})
        `);
        const existingRows = stmt.all(...topicIds) as Array<{ topic_id: string }>;
        const existingSet = new Set(existingRows.map(row => row.topic_id));

        // 返回不存在的 topicId
        return topicIds.filter(id => !existingSet.has(id));
    }

    /**
     * 获取向量数据库中的记录总数
     * @returns number
     */
    public getCount(): number {
        const stmt = this.db!.prepare(`
            SELECT COUNT(*) as count FROM topic_vector_mapping
        `);
        const result = stmt.get() as { count: number };
        return result.count;
    }

    /**
     * 相似度搜索
     * @param queryEmbedding 查询向量
     * @param topicIdCandidates 候选 topicId 集合（用于预过滤，传空数组则搜索全部）
     * @param limit 返回数量
     * @returns 按相似度排序的 { topicId, distance }[] 数组
     */
    public searchSimilar_Old(
        queryEmbedding: Float32Array,
        topicIdCandidates: string[],
        limit: number
    ): Array<{ topicId: string; distance: number }> {
        if (queryEmbedding.length !== this.dimension) {
            throw new Error(`查询向量维度不匹配：期望 ${this.dimension}，实际 ${queryEmbedding.length}`);
        }

        let sql: string;
        let params: any[];

        if (topicIdCandidates.length > 0) {
            // 有候选集，先过滤再搜索
            const placeholders = topicIdCandidates.map(() => "?").join(",");
            sql = `
                SELECT 
                    m.topic_id,
                    vec_distance_cosine(v.embedding, ?) as distance
                FROM vec_topics v
                JOIN topic_vector_mapping m ON v.rowid = m.vector_rowid
                WHERE m.topic_id IN (${placeholders})
                ORDER BY distance ASC
                LIMIT ?
            `;
            params = [queryEmbedding, ...topicIdCandidates, limit];
        } else {
            // 无候选集，搜索全部
            sql = `
                SELECT 
                    m.topic_id,
                    vec_distance_cosine(v.embedding, ?) as distance
                FROM vec_topics v
                JOIN topic_vector_mapping m ON v.rowid = m.vector_rowid
                ORDER BY distance ASC
                LIMIT ?
            `;
            params = [queryEmbedding, limit];
        }

        const stmt = this.db!.prepare(sql);
        const results = stmt.all(...params) as Array<{ topic_id: string; distance: number }>;

        return results.map(row => ({
            topicId: row.topic_id,
            distance: row.distance
        }));
    }

    /**
     * 基于KNN算法的高性能相似度搜索
     * @param queryEmbedding 查询向量
     * @param topicIdCandidates 候选 topicId 集合（用于预过滤，传空数组则搜索全部）
     * @param limit 返回数量
     * @returns 按相似度排序的 { topicId, distance }[] 数组
     */
    public searchSimilar(
        queryEmbedding: Float32Array,
        topicIdCandidates: string[],
        limit: number
    ): Array<{ topicId: string; distance: number }> {
        if (queryEmbedding.length !== this.dimension) {
            throw new Error(`查询向量维度不匹配：期望 ${this.dimension}，实际 ${queryEmbedding.length}`);
        }

        let sql: string;
        let params: any[];

        if (topicIdCandidates.length > 0) {
            // 先获取候选集的 rowid
            const placeholders = topicIdCandidates.map(() => "?").join(",");
            const mappingStmt = this.db!.prepare(`
            SELECT vector_rowid FROM topic_vector_mapping WHERE topic_id IN (${placeholders})
        `);
            const candidateRows = mappingStmt.all(...topicIdCandidates) as Array<{
                vector_rowid: number;
            }>;
            const candidateRowIds = candidateRows.map(row => row.vector_rowid);

            if (candidateRowIds.length === 0) return [];

            const rowIdPlaceholders = candidateRowIds.map(() => "?").join(",");
            // 使用 MATCH 语法进行 KNN 优化搜索
            sql = `
            SELECT 
                m.topic_id,
                v.distance
            FROM vec_topics v
            JOIN topic_vector_mapping m ON v.rowid = m.vector_rowid
            WHERE v.rowid IN (${rowIdPlaceholders})
            AND v.embedding MATCH ? AND k = ?
            ORDER BY v.distance ASC
            LIMIT ?
        `;
            params = [...candidateRowIds, queryEmbedding, limit, limit];
        } else {
            // 无候选集，使用 KNN 优化搜索
            sql = `
            SELECT 
                m.topic_id,
                v.distance
            FROM vec_topics v
            JOIN topic_vector_mapping m ON v.rowid = m.vector_rowid
            WHERE v.embedding MATCH ? AND k = ? 
            ORDER BY v.distance ASC
            LIMIT ?
        `;
            params = [queryEmbedding, limit, limit];
        }

        const stmt = this.db!.prepare(sql);
        const results = stmt.all(...params) as Array<{ topic_id: string; distance: number }>;

        return results.map(row => ({
            topicId: row.topic_id,
            distance: row.distance
        }));
    }
}
