// lib/agenda.ts
import { Agenda } from "@hokify/agenda";

import Logger from "../util/Logger";

const LOGGER = Logger.withTag("🕗 common/scheduler");

// 注意：这个实例在不同的node进程中不共享
export const agendaInstance = new Agenda({
    db: {
        address: process.env.SYNTHOS_MONGODB_URL || process.env.MONGODB_URL || "mongodb://localhost:27017/synthos",
        collection: "synthos_jobs" // 自定义集合名
    },
    processEvery: "10 seconds", // 每10秒检查一次待处理任务
    maxConcurrency: 10, // 支持并行执行多个任务（用于工作流并行节点）
    defaultLockLifetime: 60000 * 10 // 任务默认锁定时间为10分钟，如想延长，可以调用job.touch()
});

agendaInstance.on("ready", () => {
    LOGGER.success("Agenda实例创建成功");
});
