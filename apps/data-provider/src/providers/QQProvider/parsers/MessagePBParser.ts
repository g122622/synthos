import * as protobuf from "protobufjs";
import { readFile } from "fs/promises";
import ErrorReasons from "@root/common/types/ErrorReasons";
import Logger from "@root/common/util/Logger";
import { RawMsgContentParseResult } from "../@types/RawMsgContentParseResult";

export class MessagePBParser {
    private messageSegment: protobuf.Type | undefined;
    private LOGGER = Logger.withTag("MessagePBParser");

    public async init() {
        // 1. 加载 .proto 文件（或直接用字符串） TODO：换一种加载方式，不要这么原始
        const protoContent = await readFile(
            "./src/providers/QQProvider/parsers/messageSegment.proto",
            "utf8"
        );

        // 2. 动态构建 Root
        const root = protobuf.parse(protoContent).root;

        // 3. 获取 MessageSegment 类型
        this.messageSegment = root.lookupType("Message");
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
