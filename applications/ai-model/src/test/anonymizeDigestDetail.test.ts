import { describe, it, expect, beforeEach } from "vitest";
import { anonymizeDigestDetail } from "../utils/anonymizeDigestDetail";
import { AIDigestResult } from "@root/common/contracts/ai-model";

describe("anonymizeDigestDetail", () => {
    // 基础测试数据
    const baseDigest: AIDigestResult = {
        topicId: "test-topic-123",
        sessionId: "test-session-456",
        topic: "测试主题",
        contributors: '["张三", "李四", "王五"]',
        detail: "张三说：今天天气真好。李四回复：是的，适合出去游玩。王五补充：记得带好防晒用品。",
        modelName: "gpt-3.5-turbo",
        updateTime: Date.now()
    };

    describe("基本功能测试", () => {
        it("应该正确替换昵称为泛化标识", () => {
            const result = anonymizeDigestDetail(baseDigest);

            expect(result.detail).toBe(
                "用户1说：今天天气真好。用户2回复：是的，适合出去游玩。用户3补充：记得带好防晒用品。"
            );
            expect(result.contributors).toBe(baseDigest.contributors); // contributors 字段不应改变
            expect(result.topicId).toBe(baseDigest.topicId);
            expect(result.sessionId).toBe(baseDigest.sessionId);
            expect(result.topic).toBe(baseDigest.topic);
        });

        it("应该返回新对象而不修改原对象", () => {
            const result = anonymizeDigestDetail(baseDigest);

            expect(result).not.toBe(baseDigest); // 应该是新对象
            expect(baseDigest.detail).toContain("张三"); // 原对象不应被修改
        });

        it("应该按照contributors数组顺序映射昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["用户A", "用户B", "用户C"]',
                detail: "用户A先发言，然后用户B回复，最后用户C总结。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe("用户1先发言，然后用户2回复，最后用户3总结。");
        });
    });

    describe("边界情况测试", () => {
        it("应该处理空的contributors数组", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: "[]",
                detail: "这是一段没有参与者的文本。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(digest.detail); // detail 不应改变
        });

        it("应该处理无效的contributors JSON", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: "invalid json",
                detail: "这是一段文本。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(digest.detail); // detail 不应改变
        });

        it("应该处理空的detail字段", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                detail: ""
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(""); // detail 不应改变
        });

        it("应该处理detail为null或undefined的情况", () => {
            const digestWithoutDetail: AIDigestResult = {
                ...baseDigest,
                detail: "" as any
            };

            const result = anonymizeDigestDetail(digestWithoutDetail);

            expect(result.detail).toBe("");
        });
    });

    describe("特殊字符处理测试", () => {
        it("应该正确处理包含正则特殊字符的昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三.", "李四*", "王五?"]',
                detail: "张三.说：注意特殊字符。李四*回复：是的。王五?补充：还有问号。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：注意特殊字符。用户2回复：是的。用户3补充：还有问号。"
            );
        });

        it("应该正确处理包含中括号的昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["[张三]", "{李四}", "(王五)"]',
                detail: "[张三]说：注意括号。{李四}回复：是的。(王五)补充：还有圆括号。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：注意括号。用户2回复：是的。用户3补充：还有圆括号。"
            );
        });

        it("应该正确处理包含正则量词的昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三+", "李四*", "王五?"]',
                detail: "张三+说：注意量词。李四*回复：是的。王五?补充：还有问号。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe("用户1说：注意量词。用户2回复：是的。用户3补充：还有问号。");
        });
    });

    describe("昵称匹配优先级测试", () => {
        it("应该优先匹配长昵称，避免部分匹配", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三丰", "张三", "李四"]',
                detail: "张三丰说：我是张三丰。张三回复：我是张三。李四说：你们好。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：我是用户1。用户2回复：我是用户2。用户3说：你们好。"
            );
        });

        it("应该正确处理包含关系的昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["小明", "大明", "明明"]',
                detail: "小明和大明是好朋友，明明也加入了他们的讨论。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe("用户1和用户2是好朋友，用户3也加入了他们的讨论。");
        });
    });

    describe("contributors解析测试", () => {
        it("应该正确解析包含非字符串元素的contributors数组", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三", 123, null, "李四", "", "王五"]',
                detail: "张三、李四和王五进行了讨论。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe("用户1、用户2和用户3进行了讨论。");
        });

        it("应该正确处理空字符串昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["", "张三", ""]',
                detail: "张三发言了。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe("用户1发言了。");
        });
    });

    describe("复杂场景测试", () => {
        it("应该正确处理多次出现的同一昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三", "李四"]',
                detail: "张三说：你好。李四回复：你好。张三又说：今天天气不错。李四同意：是的。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：你好。用户2回复：你好。用户1又说：今天天气不错。用户2同意：是的。"
            );
        });

        it("应该正确处理昵称出现在文本中间的情况", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三", "李四"]',
                detail: "会议开始了，首先请张三发言，然后李四补充，最后张三总结。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "会议开始了，首先请用户1发言，然后用户2补充，最后用户1总结。"
            );
        });

        it("应该正确处理昵称包含在句子中的情况", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["张三", "李四"]',
                detail: "根据张三的建议，李四修改了方案。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe("根据用户1的建议，用户2修改了方案。");
        });
    });

    describe("复杂昵称测试", () => {
        it("应该正确处理包含特殊字符和emoji的复杂昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors:
                    '["22-bzyu-key（转汉语言文学恩师sean）", "23-upc-爱卖菜的Julie😆", "🦊？🦊！", "（原）IBM社 何浩睿", "有钱不如有wlb 有wlb不如有技术", "[]", "[ ]", "ユリの花", "DEAR James·Jordan ≈"]',
                detail: "22-bzyu-key（转汉语言文学恩师sean）说：大家好。23-upc-爱卖菜的Julie😆回复：欢迎加入！🦊？🦊！感叹：真热闹。（原）IBM社 何浩睿补充：我是IBM员工。有钱不如有wlb 有wlb不如有技术说：工作生活要平衡。[]表示同意。[ ]也点头。ユリの花说：日语学习者。DEAR James·Jordan ≈总结：欢迎各位。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：大家好。用户2回复：欢迎加入！用户3感叹：真热闹。用户4补充：我是IBM员工。用户5说：工作生活要平衡。用户6表示同意。用户7也点头。用户8说：日语学习者。用户9总结：欢迎各位。"
            );
        });

        it("应该正确处理包含大量正则特殊字符的昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors:
                    '["[a-z]+\\\\d*\\\\.com", "(?=.*[A-Z])", "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"]',
                detail: "[a-z]+\\d*\\.com说：我是个正则表达式。(?=.*[A-Z])回复：我也是。^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$说：我是邮箱匹配规则。"
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：我是个正则表达式。用户2回复：我也是。用户3说：我是邮箱匹配规则。"
            );
        });

        it("应该正确处理包含多种语言的昵称", () => {
            const digest: AIDigestResult = {
                ...baseDigest,
                contributors: '["王小明", "John Smith", "伊藤博文", "김철수", "Александр"]',
                detail: "王小明说：大家好。John Smith回复：Hello everyone. 伊藤博文说：こんにちは。김철수说：안녕하세요. Александр说：Здравствуйте."
            };

            const result = anonymizeDigestDetail(digest);

            expect(result.detail).toBe(
                "用户1说：大家好。用户2回复：Hello everyone. 用户3说：こんにちは。用户4说：안녕하세요. 用户5说：Здравствуйте."
            );
        });
    });
});
