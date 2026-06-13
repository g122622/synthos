import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockMkdir, mockWriteFile, mockLogger } = vi.hoisted(() => ({
    mockMkdir: vi.fn().mockResolvedValue(undefined),
    mockWriteFile: vi.fn().mockResolvedValue(undefined),
    mockLogger: {
        info: vi.fn(),
        success: vi.fn(),
        warning: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

vi.mock("fs/promises", () => ({
    mkdir: mockMkdir,
    writeFile: mockWriteFile
}));

vi.mock("@root/common/util/Logger", () => ({
    default: {
        withTag: () => mockLogger
    }
}));

vi.mock("@root/common/util/lifecycle/mustInitBeforeUse", () => ({
    mustInitBeforeUse: <T extends new (...args: any[]) => any>(constructor: T) => constructor
}));

vi.mock("@root/common/util/lifecycle/Disposable", () => ({
    Disposable: class MockDisposable {
        protected _registerDisposable<T>(disposable: T): T {
            return disposable;
        }
        protected _registerDisposableFunction(_func: () => Promise<void> | void): void {}
        async dispose(): Promise<void> {}
        get isDisposed(): boolean {
            return false;
        }
    }
}));

import { OneBotFileProvider } from "../providers/OneBotProvider/OneBotFileProvider";

const createConfigManagerService = (overrides = {}) =>
    ({
        getCurrentConfig: vi.fn().mockResolvedValue({
            dataProviders: {
                OneBot: {
                    enabled: true,
                    baseURL: "http://127.0.0.1:3000/",
                    accessToken: "test-token",
                    downloadDirectory: "/tmp/synthos-onebot-files",
                    requestTimeoutMs: 5000,
                    ...overrides
                }
            }
        })
    }) as any;

describe("OneBotFileProvider", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal("fetch", vi.fn());
    });

    it("应通过 OneBot 接口列出群文件并归一化字段", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    status: "ok",
                    retcode: 0,
                    data: {
                        files: [
                            {
                                file_id: "file-1",
                                file_name: "资料.pdf",
                                file_size: "123",
                                upload_time: 1700000000,
                                busid: 102
                            }
                        ]
                    }
                })
            )
        );

        const provider = new OneBotFileProvider(createConfigManagerService());

        await provider.init();
        const files = await provider.listGroupFiles("123456");

        expect(files).toEqual([
            {
                groupId: "123456",
                fileId: "file-1",
                fileName: "资料.pdf",
                fileSize: 123,
                uploadTime: 1700000000000,
                busid: 102,
                folderId: ""
            }
        ]);
        expect(fetch).toHaveBeenCalledWith(
            "http://127.0.0.1:3000/get_group_root_files",
            expect.objectContaining({
                method: "POST",
                headers: expect.objectContaining({
                    authorization: "Bearer test-token"
                })
            })
        );
    });

    it("应获取群文件下载链接", async () => {
        vi.mocked(fetch).mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    status: "ok",
                    retcode: 0,
                    data: {
                        url: "https://example.com/file.pdf"
                    }
                })
            )
        );

        const provider = new OneBotFileProvider(createConfigManagerService());

        await provider.init();
        const url = await provider.getGroupFileDownloadUrl("123456", "file-1", 102);

        expect(url).toBe("https://example.com/file.pdf");
    });

    it("应下载群文件到配置目录并清洗文件名", async () => {
        vi.mocked(fetch)
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        status: "ok",
                        retcode: 0,
                        data: {
                            url: "https://example.com/file.pdf"
                        }
                    })
                )
            )
            .mockResolvedValueOnce(new Response("hello"));

        const provider = new OneBotFileProvider(createConfigManagerService());

        await provider.init();
        const result = await provider.downloadGroupFile("123456", "file-1", "a/b?.pdf", 102);

        expect(result.localPath).toBe("/tmp/synthos-onebot-files/123456/a_b_.pdf");
        expect(result.sizeBytes).toBe(5);
        expect(mockWriteFile).toHaveBeenCalledWith(
            "/tmp/synthos-onebot-files/123456/a_b_.pdf",
            Buffer.from("hello")
        );
    });
});
