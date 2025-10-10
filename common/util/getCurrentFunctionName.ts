// 获取当前函数名的辅助函数
export function getCurrentFunctionName(): string {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  Error.prepareStackTrace = (_, stack) => stack;
  const stack = new Error().stack as unknown as NodeJS.CallSite[];
  Error.prepareStackTrace = originalPrepareStackTrace;

  if (stack && stack.length > 4) {
    const functionName = stack[4].getFunctionName();
    if (functionName) {
      // 提取函数名（去除完整路径）
      const parts = functionName.split(".");
      return parts[parts.length - 1] || functionName;
    }
    return "anonymous";
  }

  return "unknown";
}
