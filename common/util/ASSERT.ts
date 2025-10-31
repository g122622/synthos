import ErrorReasons from "../types/ErrorReasons";
import Logger from "../util/Logger"

export function ASSERT(condition: any, message?: string) {
    if (!condition) {
        Logger.error('断言失败！' + (message ? message : ''));
        console.trace();
        throw ErrorReasons.ASSERTION_ERROR;
    }
}
