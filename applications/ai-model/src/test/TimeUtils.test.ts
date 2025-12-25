import { describe, it, expect } from "vitest";
import { formatTimestamp, getCurrentFormattedTime } from "@root/common/util/TimeUtils";

describe("TimeUtils", () => {
    it("应该正确格式化时间戳为 yyyy-mm-dd-hh:mm:ss 格式", () => {
        const timestamp = 1705310400000; // 2024-01-15 10:00:00 UTC
        const formatted = formatTimestamp(timestamp);

        expect(formatted).toBe("2024-01-15-17:20:00");
    });

    it("应该正确格式化带有单月/单日/小时的时间戳", () => {
        const timestamp = new Date(2024, 0, 5, 9, 8, 7).getTime(); // 2024-01-05 09:08:07
        const formatted = formatTimestamp(timestamp);

        expect(formatted).toBe("2024-01-05-09:08:07");
    });

    it("应该返回当前时间的格式化字符串", () => {
        const formatted = getCurrentFormattedTime();

        // 验证格式是否为 yyyy-mm-dd-hh:mm:ss
        expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}-\d{2}:\d{2}:\d{2}$/);

        // 验证是否为当前时间
        const now = new Date();
        const expectedFormatted = formatTimestamp(now.getTime());
        expect(formatted).toBe(expectedFormatted);
    });
});
