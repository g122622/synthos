export default function throttle<T extends (...args: any[]) => any>(func: T, wait: number, options?: { leading?: boolean; trailing?: boolean }) {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastExecTime: number | null = null;
    let lastArgs: Parameters<T> | null = null;
    let lastThis: ThisParameterType<T> | null = null;

    const { leading = true, trailing = false } = options ?? {};

    const invokeFunc = () => {
        if (lastArgs !== null && lastThis !== null) {
            func.apply(lastThis, lastArgs);
            lastArgs = null;
            lastThis = null;
        }
        lastExecTime = Date.now();
    };

    const later = () => {
        timeoutId = null;
        if (trailing && lastArgs !== null) {
            invokeFunc();
        }
    };

    const throttled = function (this: ThisParameterType<T>, ...args: Parameters<T>) {
        const currentTime = Date.now();

        // 初始化 lastExecTime
        if (lastExecTime === null) {
            lastExecTime = leading ? currentTime - wait : currentTime;
        }

        const timeSinceLastCall = currentTime - lastExecTime;

        lastArgs = args;
        lastThis = this;

        if (timeSinceLastCall >= wait) {
            // 可以立即执行
            if (timeoutId !== null) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
            invokeFunc();
        } else if (timeoutId === null && trailing) {
            // 设置延迟执行（trailing）
            timeoutId = setTimeout(later, wait - timeSinceLastCall);
        }
    };

    return throttled as T;
}
