import ErrorReasons from "@root/common/types/ErrorReasons";

export function parseMsgContentFromPB(msgBuf: Buffer, isDebug = false): string {
    if (!Buffer.isBuffer(msgBuf)) {
        throw ErrorReasons.TYPE_ERROR;
    }

    let tagStatus = 0;
    let remainLen = 0;
    let text: number[] = [];

    if (isDebug) {
        console.log("\n");
    }

    for (let i = 0; i < msgBuf.length; i++) {
        const ch = msgBuf[i];

        if (isDebug) {
            process.stdout.write(`${ch.toString(16).padStart(2, "0")} `);
        }

        if (tagStatus === 0) {
            if (ch === 0x82) {
                tagStatus = 1;
                if (isDebug) {
                    process.stdout.write("tag start, ");
                }
                continue;
            }
            if (isDebug) {
                process.stdout.write("tag ignore, ");
            }
            continue;
        }

        if (tagStatus === 1) {
            if (ch === 0x16) {
                // pure text
                tagStatus = 2;
                if (isDebug) {
                    process.stdout.write("tag text, ");
                }
                continue;
            }
            if (isDebug) {
                process.stdout.write("tag others, ");
            }
            tagStatus = -2;
            continue;
        }

        if (tagStatus === 3 || tagStatus === -3) {
            // going
            if (tagStatus > 0) {
                if (ch === 0) {
                    text.push(0x0a); // '\n'
                } else {
                    text.push(ch);
                    if (ch === 0xfd) {
                        throw new Error("unexpected");
                    }
                }
            }
            remainLen--;
            if (remainLen === 0) {
                tagStatus = 0;
            }
            continue;
        }

        // tagstatus == -2 or 2
        remainLen = ch;
        if (isDebug) {
            process.stdout.write(`tag data len ${remainLen}, `);
        }
        if (tagStatus > 0) {
            tagStatus++;
        } else {
            tagStatus--;
            remainLen--;
        }
        if (remainLen <= 0) {
            remainLen = 0;
            tagStatus = 0;
            continue;
        }
    }

    return Buffer.from(text).toString("utf8");
}
