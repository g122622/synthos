export function formatBytes(bytes: number, decimals = 2): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatRelativeTime(timestamp: number, now: number = Date.now()): string {
    if (!Number.isFinite(timestamp)) {
        return "未知";
    }

    const diffMs = now - timestamp;

    if (Math.abs(diffMs) < 30 * 1000) {
        return "刚刚";
    }

    const isFuture = diffMs < 0;
    const absMs = Math.abs(diffMs);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const month = 30 * day;
    const year = 365 * day;

    const suffix = isFuture ? "后" : "前";

    if (absMs < hour) {
        const minutes = Math.floor(absMs / minute);

        return `${minutes}分钟${suffix}`;
    }

    if (absMs < day) {
        const hours = Math.floor(absMs / hour);

        return `${hours}小时${suffix}`;
    }

    if (absMs < month) {
        const days = Math.floor(absMs / day);

        return `${days}天${suffix}`;
    }

    if (absMs < year) {
        const months = Math.floor(absMs / month);

        return `${months}个月${suffix}`;
    }

    const years = Math.floor(absMs / year);

    return `${years}年${suffix}`;
}
