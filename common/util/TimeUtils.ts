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
