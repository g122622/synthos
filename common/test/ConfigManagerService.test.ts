import { describe, it, expect, beforeEach, vi } from "vitest";

// ==================== Mock 区域 ====================

// 使用 vi.hoisted 来创建可以在 mock 中引用的变量
// 设置默认返回值以便模块加载时不会崩溃
const { mockReadFile, mockAccess, mockFindFileUpwards, mockLogger } = vi.hoisted(() => {
    const loggerInstance: Record<string, unknown> = {
        debug: vi.fn(),
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn()
    };
    loggerInstance.withTag = vi.fn().mockReturnValue(loggerInstance);

    return {
        mockReadFile: vi.fn().mockResolvedValue("{}"),
        mockAccess: vi.fn().mockRejectedValue(new Error("File not found")),
        mockFindFileUpwards: vi.fn().mockResolvedValue("/default/path/synthos_config.json"),
        mockLogger: loggerInstance
    };
});

// Mock fs/promises
vi.mock("fs/promises", () => ({
    readFile: mockReadFile,
    access: mockAccess
}));

// Mock findFileUpwards
vi.mock("@root/common/util/file/findFileUpwards", () => ({
    findFileUpwards: mockFindFileUpwards
}));

// Mock Logger 以避免循环依赖问题
vi.mock("@root/common/util/Logger", () => ({
    default: mockLogger
}));

// Mock DI container 以避免加载其他依赖
vi.mock("@root/common/di/container", () => ({
    getConfigManagerService: vi.fn()
}));

// Mock ASSERT 以避免它发送 SIGINT 信号终止进程
vi.mock("@root/common/util/ASSERT", () => ({
    ASSERT: (condition: unknown, message?: string) => {
        if (!condition) {
            throw new Error("断言失败！" + (message ? message : ""));
        }
    },
    ASSERT_NOT_FATAL: vi.fn()
}));

// 在 mock 之后导入类（不是单例实例）
import { ConfigManagerService } from "../services/config/ConfigManagerService";

// ==================== 测试数据 ====================

const mockMainConfig = {
    dataProviders: {
        QQ: {
            VFSExtPath: "/path/to/vfs",
            dbBasePath: "/path/to/db",
            dbKey: "test-key",
            dbPatch: {
                enabled: false
            }
        },
        agendaTaskIntervalInMinutes: 5
    },
    logger: {
        logLevel: "info" as const,
        logDirectory: "/logs"
    },
    groupConfigs: {}
};

const mockOverrideConfig = {
    dataProviders: {
        QQ: {
            dbKey: "override-key"
        }
    },
    logger: {
        logLevel: "debug" as const
    }
};

// ==================== 测试用例 ====================

describe("ConfigManagerService", () => {
    let service: InstanceType<typeof ConfigManagerService>;

    beforeEach(() => {
        vi.clearAllMocks();
        // 重置为默认值
        mockReadFile.mockResolvedValue(JSON.stringify(mockMainConfig));
        mockAccess.mockRejectedValue(new Error("File not found"));
    });

    describe("构造函数", () => {
        it("使用提供的 configPath 时应直接使用该路径", async () => {
            const customPath = "/custom/path/synthos_config.json";
            service = new ConfigManagerService(customPath);

            await service.getCurrentConfig();

            // 不应调用 findFileUpwards
            expect(mockFindFileUpwards).not.toHaveBeenCalled();
            expect(mockReadFile).toHaveBeenCalledWith(customPath, "utf8");
        });

        it("未提供 configPath 时应使用 findFileUpwards 查找配置文件", async () => {
            const foundPath = "/found/path/synthos_config.json";
            mockFindFileUpwards.mockResolvedValue(foundPath);

            service = new ConfigManagerService();
            await service.getCurrentConfig();

            expect(mockFindFileUpwards).toHaveBeenCalledWith("synthos_config.json");
            expect(mockReadFile).toHaveBeenCalledWith(foundPath, "utf8");
        });
    });

    describe("getCurrentConfig", () => {
        it("当配置文件路径未找到时应抛出断言错误", async () => {
            mockFindFileUpwards.mockResolvedValue(undefined);
            service = new ConfigManagerService();

            await expect(service.getCurrentConfig()).rejects.toThrow("未找到配置文件");
        });

        it("当只有主配置文件时应返回主配置内容", async () => {
            const configPath = "/path/to/synthos_config.json";
            service = new ConfigManagerService(configPath);

            const config = await service.getCurrentConfig();

            expect(mockReadFile).toHaveBeenCalledWith(configPath, "utf8");
            expect(mockAccess).toHaveBeenCalledWith("/path/to/synthos_config_override.json");
            expect(config).toEqual(mockMainConfig);
        });

        it("当存在 override 配置文件时应合并配置", async () => {
            const configPath = "/path/to/synthos_config.json";
            const overridePath = "/path/to/synthos_config_override.json";

            mockAccess.mockResolvedValue(undefined); // override 存在
            mockReadFile
                .mockResolvedValueOnce(JSON.stringify(mockMainConfig))
                .mockResolvedValueOnce(JSON.stringify(mockOverrideConfig));

            service = new ConfigManagerService(configPath);
            const config = await service.getCurrentConfig();

            expect(mockReadFile).toHaveBeenCalledWith(configPath, "utf8");
            expect(mockReadFile).toHaveBeenCalledWith(overridePath, "utf8");

            // 验证合并结果
            expect(config.logger.logLevel).toBe("debug"); // 被覆盖
            expect(config.logger.logDirectory).toBe("/logs"); // 保持原值
            expect(config.dataProviders.QQ.dbKey).toBe("override-key"); // 嵌套属性被覆盖
            expect(config.dataProviders.QQ.VFSExtPath).toBe("/path/to/vfs"); // 嵌套属性保持原值
        });
    });

    describe("deepMerge（通过 getCurrentConfig 间接测试）", () => {
        it("override 中不存在的 key 不应覆盖主配置", async () => {
            const configPath = "/path/to/synthos_config.json";
            // JSON.stringify 会移除 undefined 值，所以这个测试实际上测试的是 key 不存在的情况
            const overridePartial = {
                logger: {
                    logDirectory: "/override/logs"
                    // logLevel 不存在，应该保持原值
                }
            };

            mockAccess.mockResolvedValue(undefined);
            mockReadFile
                .mockResolvedValueOnce(JSON.stringify(mockMainConfig))
                .mockResolvedValueOnce(JSON.stringify(overridePartial));

            service = new ConfigManagerService(configPath);
            const config = await service.getCurrentConfig();

            // 不存在的 key 不应覆盖原值
            expect(config.logger.logLevel).toBe("info");
            // 有值的应该覆盖
            expect(config.logger.logDirectory).toBe("/override/logs");
        });

        it("数组类型应被完整替换而非合并", async () => {
            const mainWithArray = {
                ...mockMainConfig,
                ai: {
                    models: {},
                    defaultModelConfig: {
                        apiKey: "key",
                        baseURL: "url",
                        temperature: 0.7,
                        maxTokens: 1000
                    },
                    defaultModelName: "gpt-4",
                    summarize: { agendaTaskIntervalInMinutes: 5 },
                    interestScore: {
                        agendaTaskIntervalInMinutes: 5,
                        UserInterestsPositiveKeywords: ["tech", "coding"],
                        UserInterestsNegativeKeywords: ["spam"]
                    }
                }
            };

            const overrideWithArray = {
                ai: {
                    interestScore: {
                        UserInterestsPositiveKeywords: ["new", "keywords"]
                    }
                }
            };

            const configPath = "/path/to/synthos_config.json";
            mockAccess.mockResolvedValue(undefined);
            mockReadFile
                .mockResolvedValueOnce(JSON.stringify(mainWithArray))
                .mockResolvedValueOnce(JSON.stringify(overrideWithArray));

            service = new ConfigManagerService(configPath);
            const config = await service.getCurrentConfig();

            // 数组应被完整替换
            expect(config.ai.interestScore.UserInterestsPositiveKeywords).toEqual([
                "new",
                "keywords"
            ]);
            // 其他数组保持原值
            expect(config.ai.interestScore.UserInterestsNegativeKeywords).toEqual(["spam"]);
        });

        it("深层嵌套对象应正确合并", async () => {
            const configPath = "/path/to/synthos_config.json";
            const deepOverride = {
                dataProviders: {
                    QQ: {
                        dbPatch: {
                            enabled: true,
                            patchSQL: "SELECT 1"
                        }
                    }
                }
            };

            mockAccess.mockResolvedValue(undefined);
            mockReadFile
                .mockResolvedValueOnce(JSON.stringify(mockMainConfig))
                .mockResolvedValueOnce(JSON.stringify(deepOverride));

            service = new ConfigManagerService(configPath);
            const config = await service.getCurrentConfig();

            // 深层嵌套应正确合并
            expect(config.dataProviders.QQ.dbPatch.enabled).toBe(true);
            expect(config.dataProviders.QQ.dbPatch.patchSQL).toBe("SELECT 1");
            // 其他嵌套属性应保持
            expect(config.dataProviders.QQ.VFSExtPath).toBe("/path/to/vfs");
            expect(config.dataProviders.QQ.dbKey).toBe("test-key");
        });

        it("null 值应覆盖原值", async () => {
            const configPath = "/path/to/synthos_config.json";
            const overrideWithNull = {
                logger: {
                    logDirectory: null
                }
            };

            mockAccess.mockResolvedValue(undefined);
            mockReadFile
                .mockResolvedValueOnce(JSON.stringify(mockMainConfig))
                .mockResolvedValueOnce(JSON.stringify(overrideWithNull));

            service = new ConfigManagerService(configPath);
            const config = await service.getCurrentConfig();

            // null 应该覆盖原值
            expect(config.logger.logDirectory).toBeNull();
        });

        it("override 中的新属性应被添加到结果中", async () => {
            const configPath = "/path/to/synthos_config.json";
            const overrideWithNewProp = {
                dataProviders: {
                    QQ: {
                        newProperty: "new-value"
                    }
                }
            };

            mockAccess.mockResolvedValue(undefined);
            mockReadFile
                .mockResolvedValueOnce(JSON.stringify(mockMainConfig))
                .mockResolvedValueOnce(JSON.stringify(overrideWithNewProp));

            service = new ConfigManagerService(configPath);
            const config = await service.getCurrentConfig();

            // 新属性应被添加
            expect((config.dataProviders.QQ as Record<string, unknown>).newProperty).toBe(
                "new-value"
            );
            // 原有属性保持
            expect(config.dataProviders.QQ.VFSExtPath).toBe("/path/to/vfs");
        });
    });
});
