/**
 * 获取距离当前时间 arg 小时前的毫秒时间戳
 * @param arg 小时数（可以是正数或负数）
 * @returns 对应的毫秒时间戳（number 类型）
 */
export function getHoursAgoTimestamp(arg: number): number {
    const now = Date.now(); // 当前时间的毫秒时间戳
    const millisecondsInHour = 60 * 60 * 1000; // 1 小时对应的毫秒数
    return now - arg * millisecondsInHour;
}

/**
 * 获取距离当前时间 arg 分钟前的毫秒时间戳
 * @param arg 分钟数（可以是正数或负数）
 * @returns 对应的毫秒时间戳（number 类型）
 */
export function getMinutesAgoTimestamp(arg: number): number {
    const now = Date.now(); // 当前时间的毫秒时间戳
    const millisecondsInMinute = 60 * 1000; // 1 分钟对应的毫秒数
    return now - arg * millisecondsInMinute;
}

/**
 * 将时间戳格式化为自然文本格式 yyyy-mm-dd-hh:mm:ss
 * @param timestamp 毫秒时间戳
 * @returns 格式化后的日期字符串
 */
export function formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}-${month}-${day}-${hours}:${minutes}:${seconds}`;
}

/**
 * 获取当前时间的格式化字符串 yyyy-mm-dd-hh:mm:ss
 * @returns 格式化后的当前日期字符串
 */
export function getCurrentFormattedTime(): string {
    return formatTimestamp(Date.now());
}
