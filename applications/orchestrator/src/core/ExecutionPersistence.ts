import "reflect-metadata";
import * as fs from "fs/promises";
import * as path from "path";

import { injectable, inject } from "tsyringe";
import sqlite3 from "sqlite3";
import {
    WorkflowExecution,
    WorkflowExecutionStatus,
    NodeState,
    NodeExecutionStatus
} from "@root/common/contracts/workflow/index";
import { PromisifiedSQLite } from "@root/common/util/promisify/PromisifiedSQLite";
import Logger from "@root/common/util/Logger";
import { Disposable } from "@root/common/util/lifecycle/Disposable";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { ConfigManagerService } from "@root/common/services/config/ConfigManagerService";
import { COMMON_TOKENS } from "@root/common/di/tokens";

const LOGGER = Logger.withTag("💾 ExecutionPersistence");

/**
 * 工作流执行状态持久化服务
 * 负责将工作流执行实例保存到 SQLite 数据库
 */
@injectable()
@mustInitBeforeUse
export class ExecutionPersistence extends Disposable {
    private db: PromisifiedSQLite;
    private _dbPath: string = "";

    /**
     * 构造函数
     * @param configManagerService 配置管理服务
     */
    public constructor(
        @inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: ConfigManagerService
    ) {
        super();
        this.db = this._registerDisposable(new PromisifiedSQLite(sqlite3));
    }

    /**
     * 初始化数据库连接
     */
    public async init(): Promise<void> {
        const config = await this.configManagerService.getCurrentConfig();
        const dbBasePath = config.commonDatabase.dbBasePath;

        // 确保目录存在
        await fs.mkdir(dbBasePath, { recursive: true });

        // 数据库文件路径
        this._dbPath = path.join(dbBasePath, "synthos_workflow_executions.db");

        await this.db.open(this._dbPath);

        // 创建表结构
        await this._createTables();

        LOGGER.success("执行持久化服务初始化完成");
    }

    /**
     * 创建数据库表结构
     */
    private async _createTables(): Promise<void> {
        // 启用外键约束（SQLite 默认不启用）
        await this.db.exec("PRAGMA foreign_keys = ON;");

        const createExecutionsTableSQL = `
            CREATE TABLE IF NOT EXISTS workflow_executions (
                executionId TEXT PRIMARY KEY,
                workflowId TEXT NOT NULL,
                status TEXT NOT NULL,
                startedAt INTEGER NOT NULL,
                completedAt INTEGER,
                snapshotJson TEXT NOT NULL,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL
            );
        `;

        const createNodeStatesTableSQL = `
            CREATE TABLE IF NOT EXISTS workflow_node_states (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                executionId TEXT NOT NULL,
                nodeId TEXT NOT NULL,
                status TEXT NOT NULL,
                resultJson TEXT,
                createdAt INTEGER NOT NULL,
                updatedAt INTEGER NOT NULL,
                FOREIGN KEY (executionId) REFERENCES workflow_executions(executionId) ON DELETE CASCADE,
                UNIQUE(executionId, nodeId)
            );
        `;

        const createIndexSQL = `
            CREATE INDEX IF NOT EXISTS idx_executions_workflowId ON workflow_executions(workflowId);
            CREATE INDEX IF NOT EXISTS idx_executions_status ON workflow_executions(status);
            CREATE INDEX IF NOT EXISTS idx_executions_startedAt ON workflow_executions(startedAt);
            CREATE INDEX IF NOT EXISTS idx_node_states_executionId ON workflow_node_states(executionId);
        `;

        await this.db.exec(createExecutionsTableSQL);
        await this.db.exec(createNodeStatesTableSQL);
        await this.db.exec(createIndexSQL);

        LOGGER.info("数据库表结构创建完成");
    }

    /**
     * 保存工作流执行实例
     * @param execution 工作流执行实例
     */
    public async saveExecution(execution: WorkflowExecution): Promise<void> {
        const now = Date.now();

        // 序列化流程定义快照
        const snapshotJson = JSON.stringify(execution.snapshot);

        // Upsert 执行记录
        await this.db.run(
            `INSERT INTO workflow_executions (
                executionId, workflowId, status, startedAt, completedAt, snapshotJson, createdAt, updatedAt
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(executionId) DO UPDATE SET
                status = excluded.status,
                completedAt = excluded.completedAt,
                updatedAt = excluded.updatedAt`,
            [
                execution.executionId,
                execution.workflowId,
                execution.status,
                execution.startedAt,
                execution.completedAt || null,
                snapshotJson,
                now,
                now
            ]
        );

        // 保存所有节点状态
        for (const [nodeId, nodeState] of execution.nodeStates.entries()) {
            const resultJson = nodeState.result ? JSON.stringify(nodeState.result) : null;

            await this.db.run(
                `INSERT INTO workflow_node_states (
                    executionId, nodeId, status, resultJson, createdAt, updatedAt
                ) VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(executionId, nodeId) DO UPDATE SET
                    status = excluded.status,
                    resultJson = excluded.resultJson,
                    updatedAt = excluded.updatedAt`,
                [execution.executionId, nodeId, nodeState.status, resultJson, now, now]
            );
        }

        LOGGER.debug(`已保存执行实例: ${execution.executionId}`);
    }

    /**
     * 加载工作流执行实例
     * @param executionId 执行 ID
     * @returns 工作流执行实例，如果不存在则返回 null
     */
    public async loadExecution(executionId: string): Promise<WorkflowExecution | null> {
        // 查询执行记录
        const executionRow = (await this.db.get(
            `SELECT executionId, workflowId, status, startedAt, completedAt, snapshotJson
             FROM workflow_executions
             WHERE executionId = ?`,
            [executionId]
        )) as
            | {
                  executionId: string;
                  workflowId: string;
                  status: WorkflowExecutionStatus;
                  startedAt: number;
                  completedAt: number | null;
                  snapshotJson: string;
              }
            | undefined;

        if (!executionRow) {
            LOGGER.warning(`执行实例不存在: ${executionId}`);

            return null;
        }

        // 查询所有节点状态
        const nodeStateRows = (await this.db.all(
            `SELECT nodeId, status, resultJson
             FROM workflow_node_states
             WHERE executionId = ?`,
            [executionId]
        )) as Array<{
            nodeId: string;
            status: NodeExecutionStatus;
            resultJson: string | null;
        }>;

        // 构建节点状态 Map
        const nodeStates = new Map<string, NodeState>();

        for (const row of nodeStateRows) {
            nodeStates.set(row.nodeId, {
                nodeId: row.nodeId,
                status: row.status,
                result: row.resultJson ? JSON.parse(row.resultJson) : undefined
            });
        }

        // 反序列化流程定义快照
        const snapshot = JSON.parse(executionRow.snapshotJson);

        const execution: WorkflowExecution = {
            executionId: executionRow.executionId,
            workflowId: executionRow.workflowId,
            status: executionRow.status,
            startedAt: executionRow.startedAt,
            completedAt: executionRow.completedAt || undefined,
            nodeStates,
            snapshot
        };

        LOGGER.debug(`已加载执行实例: ${executionId}`);

        return execution;
    }

    /**
     * 列举指定工作流的执行历史
     * @param workflowId 工作流 ID
     * @param limit 返回数量限制
     * @returns 执行实例列表（按开始时间倒序）
     */
    public async listExecutions(workflowId: string, limit: number = 50): Promise<WorkflowExecution[]> {
        // 查询执行记录
        const executionRows = (await this.db.all(
            `SELECT executionId, workflowId, status, startedAt, completedAt, snapshotJson
             FROM workflow_executions
             WHERE workflowId = ?
             ORDER BY startedAt DESC
             LIMIT ?`,
            [workflowId, limit]
        )) as Array<{
            executionId: string;
            workflowId: string;
            status: WorkflowExecutionStatus;
            startedAt: number;
            completedAt: number | null;
            snapshotJson: string;
        }>;

        const executions: WorkflowExecution[] = [];

        for (const row of executionRows) {
            // 查询该执行的所有节点状态
            const nodeStateRows = (await this.db.all(
                `SELECT nodeId, status, resultJson
                 FROM workflow_node_states
                 WHERE executionId = ?`,
                [row.executionId]
            )) as Array<{
                nodeId: string;
                status: NodeExecutionStatus;
                resultJson: string | null;
            }>;

            const nodeStates = new Map<string, NodeState>();

            for (const stateRow of nodeStateRows) {
                nodeStates.set(stateRow.nodeId, {
                    nodeId: stateRow.nodeId,
                    status: stateRow.status,
                    result: stateRow.resultJson ? JSON.parse(stateRow.resultJson) : undefined
                });
            }

            const snapshot = JSON.parse(row.snapshotJson);

            executions.push({
                executionId: row.executionId,
                workflowId: row.workflowId,
                status: row.status,
                startedAt: row.startedAt,
                completedAt: row.completedAt || undefined,
                nodeStates,
                snapshot
            });
        }

        LOGGER.debug(`已列举工作流 [${workflowId}] 的 ${executions.length} 个执行实例`);

        return executions;
    }

    /**
     * 删除指定的执行实例
     * @param executionId 执行 ID
     */
    public async deleteExecution(executionId: string): Promise<void> {
        await this.db.run(`DELETE FROM workflow_executions WHERE executionId = ?`, [executionId]);

        LOGGER.info(`已删除执行实例: ${executionId}`);
    }

    /**
     * 获取数据库路径
     */
    public getDbPath(): string {
        return this._dbPath;
    }
}
