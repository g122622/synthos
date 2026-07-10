import { describe, it, expect } from "vitest";

import { resolveContributorIds } from "../util/topic/resolveContributorIds";

describe("resolveContributorIds", () => {
    it("应该按昵称顺序返回对应的 QQ 号数组", () => {
        const messages = [
            { timestamp: 1000, senderId: "111", senderGroupNickname: "张三", senderNickname: "zs" },
            { timestamp: 2000, senderId: "222", senderGroupNickname: "李四", senderNickname: "ls" }
        ];

        expect(resolveContributorIds(messages, ["张三", "李四"])).toEqual(["111", "222"]);
    });

    it("未命中的昵称应在该位置填空串，保持数组等长且顺序对应", () => {
        const messages = [{ timestamp: 1000, senderId: "111", senderGroupNickname: "张三", senderNickname: "zs" }];

        expect(resolveContributorIds(messages, ["张三", "不存在"])).toEqual(["111", ""]);
    });

    it("多对一时应取时间最早的那条消息的 senderId", () => {
        // 同一昵称"张三"对应两个不同 QQ 号，时间更早的 111 应胜出
        const messages = [
            { timestamp: 5000, senderId: "999", senderGroupNickname: "张三", senderNickname: "late" },
            { timestamp: 1000, senderId: "111", senderGroupNickname: "张三", senderNickname: "early" },
            { timestamp: 3000, senderId: "555", senderGroupNickname: "张三", senderNickname: "mid" }
        ];

        expect(resolveContributorIds(messages, ["张三"])).toEqual(["111"]);
    });

    it("应同时匹配 senderGroupNickname 和 senderNickname", () => {
        const messages = [
            { timestamp: 1000, senderId: "111", senderGroupNickname: "群昵称甲", senderNickname: "QQ昵称甲" }
        ];

        // 两种昵称形式都应命中同一个 QQ 号
        expect(resolveContributorIds(messages, ["群昵称甲", "QQ昵称甲"])).toEqual(["111", "111"]);
    });

    it("消息乱序时应仍按时间最早取值（不依赖入库顺序）", () => {
        const messages = [
            { timestamp: 3000, senderId: "333", senderGroupNickname: "甲", senderNickname: "a" },
            { timestamp: 1000, senderId: "111", senderGroupNickname: "甲", senderNickname: "b" },
            { timestamp: 2000, senderId: "222", senderGroupNickname: "甲", senderNickname: "c" }
        ];

        expect(resolveContributorIds(messages, ["甲"])).toEqual(["111"]);
    });

    it("空昵称数组应返回空数组", () => {
        const messages = [{ timestamp: 1000, senderId: "111", senderGroupNickname: "张三", senderNickname: "zs" }];

        expect(resolveContributorIds(messages, [])).toEqual([]);
    });

    it("空消息数组时所有昵称都应填空串", () => {
        expect(resolveContributorIds([], ["张三", "李四"])).toEqual(["", ""]);
    });
});
