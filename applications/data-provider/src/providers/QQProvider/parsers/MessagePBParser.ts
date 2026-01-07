// 使用动态导入来确保在不同模块系统下都能正常工作
import { readFile } from "fs/promises";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import Logger from "@root/common/util/Logger";
import { RawMsgContentParseResult } from "../@types/RawMsgContentParseResult";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

@mustInitBeforeUse
export class MessagePBParser extends Disposable {
    private messageSegment: any | undefined;
    private LOGGER = Logger.withTag("MessagePBParser");
    private protobuf: any = null;

    public async init() {
        this.LOGGER.debug("Initializing MessagePBParser...");

        // 动态导入protobufjs库，确保在不同环境下都能正常工作
        try {
            // 尝试不同的导入方式
            const protobufModule = await import("protobufjs");
            this.protobuf = protobufModule.default || protobufModule;
            this.LOGGER.debug("Successfully imported protobufjs library");
        } catch (error) {
            this.LOGGER.error("Failed to import protobufjs:" + error);
            throw ErrorReasons.PROTOBUF_ERROR;
        }

        // 1. 加载 .proto 文件
        const pathCandidates = [
            "./src/providers/QQProvider/parsers/messageSegment.proto",
            "./applications/data-provider/src/providers/QQProvider/parsers/messageSegment.proto"
        ];
        let protoContent: string | undefined = undefined;
        for (const path of pathCandidates) {
            try {
                this.LOGGER.debug(`Trying to read file ${path}...`);
                protoContent = await readFile(path, "utf8");
                this.LOGGER.debug(`Successfully read file ${path}`);
                break;
            } catch (error) {
                this.LOGGER.warning(`Failed to read file ${path}: ${error}`);
            }
        }
        if (!protoContent) {
            this.LOGGER.error("Failed to read messageSegment.proto");
            throw ErrorReasons.NOT_EXIST;
        }

        // 2. 动态构建 Root
        this.LOGGER.debug("Building Root from messageSegment.proto...");

        let root;
        try {
            // 检查可用的解析方法
            if (typeof this.protobuf.parse === "function") {
                const parseResult = this.protobuf.parse(protoContent);
                root = parseResult.root;
                this.LOGGER.debug("Successfully parsed using protobuf.parse()");
            } else if (typeof this.protobuf.load === "function") {
                // 使用load方法作为备选
                root = await new Promise((resolve, reject) => {
                    this.protobuf.load(protoContent, (err: any, root: unknown) => {
                        if (err) reject(err);
                        else resolve(root);
                    });
                });
                this.LOGGER.debug("Successfully parsed using protobuf.load()");
            } else if (this.protobuf.Root) {
                // 使用Root类手动解析
                root = new this.protobuf.Root();
                this.protobuf.parse(protoContent, root);
                this.LOGGER.debug("Successfully parsed using Root class");
            } else {
                throw new Error("No available protobuf parsing method found");
            }
        } catch (error) {
            this.LOGGER.error("Protobuf parse error:" + error);

            // 最后的备选方案：使用同步解析
            try {
                const { parse } = await import("protobufjs");
                const parseResult = parse(protoContent);
                root = parseResult.root;
                this.LOGGER.debug("Successfully parsed using fallback method");
            } catch (fallbackError) {
                this.LOGGER.error("All protobuf parsing methods failed:" + fallbackError);
                throw ErrorReasons.PROTOBUF_ERROR;
            }
        }

        // 3. 获取 MessageSegment 类型
        this.messageSegment = root.lookupType("Message");
        if (!this.messageSegment) {
            this.LOGGER.error("Failed to lookup Message type");
            throw ErrorReasons.PROTOBUF_ERROR;
        }
        this.LOGGER.debug("Successfully looked up MessageSegment type");
    }

    public parseMessageSegment(buffer: Buffer): RawMsgContentParseResult {
        if (!this.messageSegment) {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }

        if (!this.protobuf) {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }

        const errMsg = this.messageSegment.verify(buffer);
        if (errMsg) {
            this.LOGGER.error("Protobuf verify error:" + errMsg);
            console.dir;
            throw ErrorReasons.PROTOBUF_ERROR;
        }

        try {
            const message = this.messageSegment.decode(buffer);
            const plain = this.messageSegment.toObject(message, {
                longs: String, // 长整数转字符串（可选）
                enums: String, // 枚举转字符串（可选）
                bytes: String, // bytes 转 base64 字符串（或保留为 Buffer）
                defaults: true,
                arrays: true,
                objects: true
            });
            return plain as RawMsgContentParseResult;
        } catch (error) {
            this.LOGGER.error("Protobuf decode error:" + error);
            throw ErrorReasons.PROTOBUF_ERROR;
        }
    }
}
