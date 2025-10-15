// lib/agenda.ts
import { Agenda } from "@hokify/agenda";

// 注意：这个实例在不同的node进程中不共享
export const agendaInstance = new Agenda({
    db: {
        address: "mongodb://localhost:27017/synthos",
        collection: "synthos_jobs" // 自定义集合名
    },
    processEvery: "30 seconds", // 每30秒检查一次待处理任务
    maxConcurrency: 5,
    defaultLockLifetime: 60000 // 锁定1分钟防止崩溃后重复执行
});
