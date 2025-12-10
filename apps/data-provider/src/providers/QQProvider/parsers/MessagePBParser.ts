import * as protobuf from "protobufjs";
import { readFile } from "fs/promises";
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import Logger from "@root/common/util/Logger";
import { RawMsgContentParseResult } from "../@types/RawMsgContentParseResult";
import { mustInitBeforeUse } from "@root/common/util/lifecycle/mustInitBeforeUse";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

@mustInitBeforeUse
export class MessagePBParser extends Disposable {
    private messageSegment: protobuf.Type | undefined;
    private LOGGER = Logger.withTag("MessagePBParser");

    public async init() {
        this.LOGGER.info("Initializing MessagePBParser...");
        // 1. 加载 .proto 文件（或直接用字符串） TODO：换一种加载方式，不要这么原始
        const pathCandidates = [
            "./src/providers/QQProvider/parsers/messageSegment.proto",
            "./apps/data-provider/src/providers/QQProvider/parsers/messageSegment.proto"
        ];
        let protoContent: string | undefined = undefined;
        for (const path of pathCandidates) {
            try {
                this.LOGGER.info(`Trying to read file ${path}...`);
                protoContent = await readFile(path, "utf8");
                this.LOGGER.info(`Successfully read file ${path}`);
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
        this.LOGGER.info("Building Root from messageSegment.proto...");
        console.dir(protobuf.parse)
        const root = protobuf.parse(protoContent).root;
        this.LOGGER.info("Successfully parsed messageSegment.proto");

        // 3. 获取 MessageSegment 类型
        this.messageSegment = root.lookupType("Message");
        this.LOGGER.info("Successfully looked up MessageSegment type");
    }

    public parseMessageSegment(buffer: Buffer): RawMsgContentParseResult {
        if (!this.messageSegment) {
            throw ErrorReasons.UNINITIALIZED_ERROR;
        }
        const errMsg = this.messageSegment.verify(buffer);
        if (errMsg) {
            this.LOGGER.error("Protobuf verify error:" + errMsg);
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
