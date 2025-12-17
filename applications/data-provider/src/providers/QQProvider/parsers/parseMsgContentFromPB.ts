// 基于有限状态机的消息解析器，用于从 Protocol Buffer 格式的消息中提取文本内容。
// ！！！目前已经废弃，被MessageSegmentPBParser取代。
import ErrorReasons from "@root/common/contracts/ErrorReasons";
import Logger from "@root/common/util/Logger";

/**
 * 从 Protocol Buffer 格式的 Buffer 中解析出纯文本消息内容。
 *
 * 该函数假设消息中包含特定的标签结构：
 * - 起始标签：0x82
 * - 紧随其后的子标签：0x16 表示“纯文本”
 * - 接下来的一个字节表示文本长度（len）
 * - 然后是 len 个字节的文本数据（其中 0x00 被替换为 '\n'）
 *
 * 其他标签或结构会被忽略。
 *
 * @param msgBuf - 包含 PB 编码消息的 Buffer
 * @param isDebug - 是否开启调试模式，打印解析过程
 * @returns 解析出的 UTF-8 字符串
 * @throws ErrorReasons.TYPE_ERROR - 如果 msgBuf 不是 Buffer
 */
function parseMsgContentFromPBV1(msgBuf: Buffer, isDebug = false): string {
    // 类型校验：确保输入是 Buffer
    if (!Buffer.isBuffer(msgBuf)) {
        throw ErrorReasons.TYPE_ERROR;
    }

    // 状态机状态：
    // 0: 等待起始标签 0x82
    // 1: 已读到 0x82，等待子标签（期望 0x16）
    // 2: 已确认是文本标签，即将读取长度（正数状态，表示有效文本）
    // 3: 正在读取文本内容（有效）
    // -2: 已读到 0x82，但子标签不是 0x16（无效标签）
    // -3: 正在跳过非文本内容（无效）
    let tagState = 0;

    // 剩余待读取的字节数（用于读取文本或跳过数据）
    let remainLen = 0;

    // 存储解析出的文本字节（最终会转为字符串）
    let text: number[] = [];

    // 调试：换行开始新日志
    if (isDebug) {
        console.log("\n");
    }

    // 遍历 Buffer 中的每一个字节
    for (let i = 0; i < msgBuf.length; i++) {
        const currentByte = msgBuf[i]; // 当前字节

        // 调试：打印当前字节的十六进制表示
        if (isDebug) {
            process.stdout.write(`${currentByte.toString(16).padStart(2, "0")} `);
        }

        // === 状态 0：寻找起始标签 0x82 ===
        if (tagState === 0) {
            if (currentByte === 0x82) {
                // 找到起始标签，进入状态 1
                tagState = 1;
                if (isDebug) {
                    process.stdout.write("tag start, ");
                }
                continue; // 跳过后续处理
            }
            // 不是起始标签，继续忽略
            if (isDebug) {
                process.stdout.write("tag ignore, ");
            }
            continue;
        }

        // === 状态 1：已读到 0x82，等待子标签 ===
        if (tagState === 1) {
            if (currentByte === 0x16) {
                // 子标签是 0x16，表示“纯文本”，进入状态 2（准备读长度）
                tagState = 2;
                if (isDebug) {
                    process.stdout.write("tag text, ");
                }
                continue;
            }
            // 子标签不是 0x16，说明不是文本内容，标记为无效（-2）
            if (isDebug) {
                process.stdout.write("tag others, ");
            }
            tagState = -2; // 进入“跳过”模式
            continue;
        }

        // === 状态 3 或 -3：正在读取内容（文本或跳过）===
        if (tagState === 3 || tagState === -3) {
            // 如果是有效文本（tagStatus > 0），处理字节
            if (tagState > 0) {
                if (currentByte === 0) {
                    // 将 0x00 替换为换行符 '\n'（0x0a）
                    text.push(0x0a);
                } else {
                    // 普通字节直接加入
                    text.push(currentByte);
                    // 遇到 0xFD 视为异常（可能是协议错误或未支持字符）
                    if (currentByte === 0xfd) {
                        throw new Error("unexpected");
                    }
                }
            }
            // 无论是否有效，都减少剩余长度
            remainLen--;

            // 如果读完当前字段，回到初始状态
            if (remainLen === 0) {
                tagState = 0;
            }
            continue;
        }

        // === 状态 2 或 -2：刚读完子标签，现在读取长度字节 ===
        // 此时 ch 是长度字节（一个字节表示长度）
        remainLen = currentByte;
        if (isDebug) {
            process.stdout.write(`tag data len ${remainLen}, `);
        }

        // 根据当前状态决定下一步：
        if (tagState > 0) {
            // 是有效文本标签（状态 2 → 3）
            tagState = 3; // 2 → 3
        } else {
            // 是无效标签（状态 -2 → -3），准备跳过数据
            tagState = -3; // -2 → -3
            remainLen--; // 这行代码有争议
        }

        // 如果长度 <= 0，说明没有数据可读，直接回到初始状态
        if (remainLen <= 0) {
            remainLen = 0;
            tagState = 0;
            continue;
        }
    }

    // 将收集到的字节数组转为 Buffer，再解码为 UTF-8 字符串
    return Buffer.from(text).toString("utf8");
}

/**
 * 从 Protocol Buffer 格式的 Buffer 中解析出纯文本消息内容。
 *
 * 该函数假设消息中包含特定的标签结构：
 * - 起始标签：0x82
 * - 紧随其后的子标签：0x16 表示“纯文本”
 * - 接下来的一个字节表示文本长度（len）
 * - 然后是 len 个字节的文本数据（其中 0x00 被替换为 '\n'）
 *
 * 其他标签或结构会被忽略。
 *
 * @param msgBuf - 包含 PB 编码消息的 Buffer
 * @param isDebug - 是否开启调试模式，打印解析过程
 * @returns 解析出的 UTF-8 字符串
 * @throws ErrorReasons.TYPE_ERROR - 如果 msgBuf 不是 Buffer
 */
function parseMsgContentFromPBV2(msgBuf: Buffer, isDebug = false): string {
    // 类型校验：确保输入是 Buffer
    if (!Buffer.isBuffer(msgBuf)) {
        throw ErrorReasons.TYPE_ERROR;
    }

    // 状态机状态：
    // 0: 等待起始标签 0x82
    // 1: 已读到 0x82，等待子标签（期望 0x16）
    // 2: 已确认是文本标签，即将读取长度（正数状态，表示有效文本）
    // 3: 正在读取文本内容（有效）
    let tagState = 0;

    // 剩余待读取的字节数（用于读取文本或跳过数据）
    let remainLen = 0;

    // 存储解析出的文本字节（最终会转为字符串）
    let textResult: number[][] = [[]];

    // 调试：换行开始新日志
    if (isDebug) {
        console.log("\n");
    }

    // 遍历 Buffer 中的每一个字节
    for (let i = 0; i < msgBuf.length; i++) {
        const currentByte = msgBuf[i]; // 当前字节

        // 调试：打印当前字节的十六进制表示
        if (isDebug) {
            process.stdout.write(`${currentByte.toString(16).padStart(2, "0")} `);
        }

        // === 状态 0：寻找起始标签 0x82 ===
        if (tagState === 0) {
            if (currentByte === 0x82) {
                // 找到起始标签，进入状态 1
                tagState = 1;
                if (isDebug) {
                    process.stdout.write("tag start, ");
                }
                continue; // 跳过后续处理
            }
            // 不是起始标签，继续忽略
            if (isDebug) {
                process.stdout.write("tag ignore, ");
            }
            continue;
        }

        // === 状态 1：已读到 0x82，等待子标签 ===
        if (tagState === 1) {
            if (currentByte === 0x16) {
                // 子标签是 0x16，表示“纯文本”，进入状态 2（准备读长度）
                tagState = 2;
                if (isDebug) {
                    process.stdout.write("tag text, ");
                }
                continue;
            }
            // 子标签不是 0x16，说明不是文本内容，回到初始状态
            if (isDebug) {
                process.stdout.write("tag others, ");
            }
            tagState = 0;
            continue;
        }

        // === 状态 3：正在读取内容 ===
        if (tagState === 3) {
            // 如果是有效文本（tagStatus > 0），处理字节
            if (currentByte === 0) {
                // 将 0x00 替换为换行符 '\n'（0x0a）
                textResult[textResult.length - 1].push(0x0a);
            } else {
                // 普通字节直接加入
                textResult[textResult.length - 1].push(currentByte);
                // 遇到 0xFD 视为异常（可能是协议错误或未支持字符）
                if (currentByte === 0xfd) {
                    throw new Error("unexpected");
                }
            }

            // 减少剩余长度
            remainLen--;

            // 如果读完当前字段，回到初始状态
            if (remainLen === 0) {
                tagState = 0;
            }
            continue;
        }

        // === 状态 2：刚读完子标签，现在读取长度字节 ===
        // 此时 ch 是长度字节（一个字节表示长度）
        remainLen = currentByte;
        if (isDebug) {
            process.stdout.write(`tag data len ${remainLen}, `);
        }

        // 是有效文本标签（状态 2 → 3）
        tagState = 3; // 2 → 3

        // 如果长度 <= 0，说明没有数据可读，直接回到初始状态
        if (remainLen <= 0) {
            remainLen = 0;
            tagState = 0;
            continue;
        } else if (remainLen > 0) {
            textResult.push([]); // 准备读取下一个文本字段
        }
    }

    // 合并所有文本字段，使用逗号连接
    let result = "";
    textResult = textResult.filter(item => item.length > 0);
    for (let i = 0; i < textResult.length; i++) {
        result += Buffer.from(textResult[i]).toString("utf8");
        if (i > 0) {
            result += ","; // 每个字段之间用逗号分隔
        }
    }
    return result;
}

export function parseMsgContentFromPB(msgBuf: Buffer, isDebug = false): string {
    return parseMsgContentFromPBV2(msgBuf, isDebug);
}
