import Logger from "../util/Logger";

export function ASSERT(condition: any, message?: string) {
    if (!condition) {
        Logger.error("断言失败！" + (message ? message : ""));
        console.trace();
        // 给当前进程发送SIGINT信号，终止进程
        process.kill(process.pid, "SIGINT");
    }
}

export function ASSERT_NOT_FATAL(condition: any, message?: string) {
    if (!condition) {
        Logger.error("断言失败！" + (message ? message : ""));
        console.trace();
    }
}
