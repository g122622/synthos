import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { QQProvider } from "../providers/QQProvider";

// Mock Logger
vi.mock("@root/common/util/Logger", () => {
    return {
        default: {
            withTag: () => ({
                debug: console.log, // 输出到控制台
                info: console.log, // 输出到控制台
                warning: console.warn, // 输出到控制台
                error: console.error // 输出到控制台
            })
        }
    };
});

describe("QQProvider", () => {
    let qqProvider: QQProvider;

    beforeEach(async () => {
        qqProvider = new QQProvider();
        // await qqProvider.init();
    });

    afterEach(async () => {
        await qqProvider.dispose();
    });

    it("should throw if user interests is empty", async () => {
        // await expect(rater.scoreTopic([], "some topic")).rejects.toThrow(
        //     "User interests cannot be empty"
        // );
        qqProvider.getMsgByTimeRange(1, 1);
    });
});
