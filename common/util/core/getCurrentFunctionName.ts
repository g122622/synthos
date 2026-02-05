// 获取当前函数名的辅助函数
function getCurrentFunctionNameByDepth(depth: number): string {
    const originalPrepareStackTrace = Error.prepareStackTrace;

    Error.prepareStackTrace = (_, stack) => stack;
    const stack = new Error().stack as unknown as NodeJS.CallSite[];

    Error.prepareStackTrace = originalPrepareStackTrace;

    if (stack && stack.length > depth) {
        const functionName = stack[depth].getFunctionName();

        if (functionName) {
            // 提取函数名（去除完整路径）
            const parts = functionName.split(".");

            return parts[parts.length - 1] || functionName;
        }

        return "anonymous";
    }

    return "unknown";
}

export function getCurrentFunctionName() {
    const candidates = [getCurrentFunctionNameByDepth(5), getCurrentFunctionNameByDepth(6)].filter(item => {
        return !["anonymous", "unknown", "info", "success", "debug", "warning", "error"].includes(item);
    });

    return candidates[0] || "unknown";
}
