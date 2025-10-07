import ErrorReasons from "../types/ErrorReasons";
import Logger from "../util/Logger"

export function ASSERT(condition: any) {
    if (!condition) {
        Logger.error('断言失败！');
        throw ErrorReasons.ASSERTION_ERROR;
    }
}
