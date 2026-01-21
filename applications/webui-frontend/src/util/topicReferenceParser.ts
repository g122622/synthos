import type { TopicReferenceItem } from "@/types/topicReference";

export type TopicReferenceToken =
    | { kind: "text"; text: string }
    | {
          kind: "topicRef";
          /** 1-based 引用编号，对应 references[refIndex - 1] */
          refIndex: number;
          raw: string;
      };

const _isDigit = (code: number) => code >= 48 && code <= 57;

/**
 * 将字符串按 "[话题N]" 拆分为 token。
 * 约定：N 为 1-based。
 * 注意：该实现不使用正则，便于 code review。
 */
export const splitTopicReferenceTokens = (text: string): TopicReferenceToken[] => {
    const tokens: TopicReferenceToken[] = [];
    const prefix = "[话题";

    let cursor = 0;

    while (cursor < text.length) {
        const start = text.indexOf(prefix, cursor);

        if (start === -1) {
            const rest = text.slice(cursor);

            if (rest.length > 0) {
                tokens.push({ kind: "text", text: rest });
            }
            break;
        }

        if (start > cursor) {
            tokens.push({ kind: "text", text: text.slice(cursor, start) });
        }

        let i = start + prefix.length;
        const digitsStart = i;

        while (i < text.length && _isDigit(text.charCodeAt(i))) {
            i += 1;
        }

        if (digitsStart === i) {
            // 不是 [话题N]，降级为普通文本（避免死循环，cursor 前进 1）
            tokens.push({ kind: "text", text: text.slice(start, start + 1) });
            cursor = start + 1;
            continue;
        }

        if (i >= text.length || text.charAt(i) !== "]") {
            tokens.push({ kind: "text", text: text.slice(start, start + 1) });
            cursor = start + 1;
            continue;
        }

        const refIndex = Number.parseInt(text.slice(digitsStart, i), 10);
        const raw = text.slice(start, i + 1);

        if (Number.isFinite(refIndex) && refIndex > 0) {
            tokens.push({ kind: "topicRef", refIndex, raw });
        } else {
            tokens.push({ kind: "text", text: raw });
        }

        cursor = i + 1;
    }

    return tokens;
};

/**
 * 统计正文中各个话题编号的引用次数。
 * - 仅统计严格形如 "[话题数字]" 的出现次数。
 * - 超出 references 长度的编号会被忽略。
 */
export const countTopicReferencesInContent = (content: string, references: TopicReferenceItem[]): number[] => {
    const counts = new Array(references.length).fill(0) as number[];

    if (references.length === 0) {
        return counts;
    }

    const tokens = splitTopicReferenceTokens(content);

    for (const token of tokens) {
        if (token.kind !== "topicRef") {
            continue;
        }

        const idx = token.refIndex - 1;

        if (idx < 0 || idx >= counts.length) {
            // 越界引用：按约定直接忽略
            continue;
        }

        counts[idx] += 1;
    }

    return counts;
};
