import ErrorReasons from "@root/common/types/ErrorReasons";

export function parseMsgContentFromPB(msgBuf: Buffer, isDebug = false): string {
    if (!Buffer.isBuffer(msgBuf)) {
        throw ErrorReasons.TYPE_ERROR;
    }
    
    let tagstatus = 0;
    let remainlen = 0;
    let text: number[] = [];

    if (isDebug) {
        console.log("\n");
    }

    for (let i = 0; i < msgBuf.length; i++) {
        const ch = msgBuf[i];

        if (isDebug) {
            process.stdout.write(`${ch.toString(16).padStart(2, "0")} `);
        }

        if (tagstatus === 0) {
            if (ch === 0x82) {
                tagstatus = 1;
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

        if (tagstatus === 1) {
            if (ch === 0x16) {
                // pure text
                tagstatus = 2;
                if (isDebug) {
                    process.stdout.write("tag text, ");
                }
                continue;
            }
            if (isDebug) {
                process.stdout.write("tag others, ");
            }
            tagstatus = -2;
            continue;
        }

        if (tagstatus === 3 || tagstatus === -3) {
            // going
            if (tagstatus > 0) {
                if (ch === 0) {
                    text.push(0x0a); // '\n'
                } else {
                    text.push(ch);
                    if (ch === 0xfd) {
                        throw new Error("unexpected");
                    }
                }
            }
            remainlen--;
            if (remainlen === 0) {
                tagstatus = 0;
            }
            continue;
        }

        // tagstatus == -2 or 2
        remainlen = ch;
        if (isDebug) {
            process.stdout.write(`tag data len ${remainlen}, `);
        }
        if (tagstatus > 0) {
            tagstatus++;
        } else {
            tagstatus--;
            remainlen--;
        }
        if (remainlen <= 0) {
            remainlen = 0;
            tagstatus = 0;
            continue;
        }
    }

    return Buffer.from(text).toString("utf8");
}
