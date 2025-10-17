// lib/agenda.ts
import { Agenda } from "@hokify/agenda";
import Logger from "../util/Logger";
const express = require("express");
const Agendash = require("agendash");

const LOGGER = Logger.withTag("common/scheduler");

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

agendaInstance.on("ready", () => {
    LOGGER.success("Agenda实例创建成功");
    // const expressApp = express();
    // LOGGER.success("Express实例创建成功");
    // expressApp.use("/dash", Agendash(agendaInstance));
    // LOGGER.success("Agendash挂载成功");
    // expressApp.listen(3001, () => {
    //     LOGGER.success("Agendash监听成功");
    // });
});
