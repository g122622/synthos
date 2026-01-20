/* eslint-disable @typescript-eslint/no-unused-vars */

import type { ReferenceItem } from "@/api/ragApi";

import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/react";
import { Copy } from "lucide-react";

import { Notification } from "@/util/Notification";
import TopicPopover from "@/components/topic/TopicPopover";

interface MarkdownRendererProps {
    content: string;
    showCopyButton?: boolean;
    className?: string;

    /**
     * 可选：在 Markdown 内容中将形如 [话题7] 的标注渲染成可交互引用。
     * 约定：数字 N 为 1-based，映射到 references[N-1]。
     */
    topicReferenceOptions?: {
        references: ReferenceItem[];
        favoriteTopics: Record<string, boolean>;
        readTopics: Record<string, boolean>;
        onToggleFavorite: (topicId: string) => void;
        onMarkAsRead: (topicId: string) => void;
    };
}

type TopicReferenceToken = { kind: "text"; text: string } | { kind: "topicRef"; refIndex: number; raw: string };

const _isDigit = (code: number) => code >= 48 && code <= 57;

const _splitTopicReferenceTokens = (text: string): TopicReferenceToken[] => {
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

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, showCopyButton = true, className = "", topicReferenceOptions }) => {
    const handleCopyContent = () => {
        navigator.clipboard
            .writeText(content)
            .then(() => {
                Notification.success({
                    title: "复制成功",
                    description: "内容已复制到剪贴板"
                });
            })
            .catch(err => {
                console.error("复制失败:", err);
                Notification.error({
                    title: "复制失败",
                    description: "无法复制内容到剪贴板"
                });
            });
    };

    const renderTopicReferencesInText = (text: string): React.ReactNode => {
        if (!topicReferenceOptions) {
            return text;
        }

        const tokens = _splitTopicReferenceTokens(text);

        if (tokens.length <= 1) {
            return text;
        }

        return tokens.map((t, idx) => {
            if (t.kind === "text") {
                return <React.Fragment key={`t-${idx}`}>{t.text}</React.Fragment>;
            }

            const reference = topicReferenceOptions.references[t.refIndex - 1];
            const chipClassName = "underline decoration-dotted underline-offset-2 cursor-pointer";

            if (!reference) {
                return (
                    <button
                        key={`r-${idx}`}
                        aria-label={`引用不存在：${t.raw}`}
                        className="inline-flex bg-transparent p-0 border-0"
                        title="引用不存在"
                        type="button"
                        onClick={() => {
                            Notification.error({
                                title: "引用不存在",
                                description: `未找到 ${t.raw} 对应的引用条目`
                            });
                        }}
                    >
                        <Chip className={chipClassName} color="warning" size="sm" variant="flat">
                            {t.raw}
                        </Chip>
                    </button>
                );
            }

            return (
                <TopicPopover
                    key={`r-${idx}`}
                    favoriteTopics={topicReferenceOptions.favoriteTopics}
                    readTopics={topicReferenceOptions.readTopics}
                    topicId={reference.topicId}
                    onMarkAsRead={topicReferenceOptions.onMarkAsRead}
                    onToggleFavorite={topicReferenceOptions.onToggleFavorite}
                >
                    <span className="inline-flex">
                        <Chip className={chipClassName} color="secondary" size="sm" variant="flat">
                            {t.raw}
                        </Chip>
                    </span>
                </TopicPopover>
            );
        });
    };

    const renderNodeWithTopicReferences = (node: React.ReactNode): React.ReactNode => {
        if (!topicReferenceOptions) {
            return node;
        }

        if (node === null || node === undefined || typeof node === "boolean") {
            return node;
        }

        if (typeof node === "string") {
            return renderTopicReferencesInText(node);
        }

        if (typeof node === "number") {
            return node;
        }

        if (Array.isArray(node)) {
            return node.map((child, idx) => <React.Fragment key={idx}>{renderNodeWithTopicReferences(child)}</React.Fragment>);
        }

        if (React.isValidElement(node)) {
            // 递归处理 children
            const props: any = node.props;

            if (!props || props.children === undefined) {
                return node;
            }

            return React.cloneElement(node, undefined, renderNodeWithTopicReferences(props.children));
        }

        return node;
    };

    return (
        <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
            <ReactMarkdown
                components={{
                    // 自定义组件样式
                    h1: ({ node, ...props }) => (
                        <h1 className="text-2xl font-bold mt-6 mb-4" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </h1>
                    ),
                    h2: ({ node, ...props }) => (
                        <h2 className="text-xl font-bold mt-5 mb-3" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </h2>
                    ),
                    h3: ({ node, ...props }) => (
                        <h3 className="text-lg font-bold mt-4 mb-2" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </h3>
                    ),
                    p: ({ node, ...props }) => (
                        <p className="mb-3" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </p>
                    ),
                    ul: ({ node, ...props }) => <ul className="list-disc pl-6 mb-3" {...props} />,
                    ol: ({ node, ...props }) => <ol className="list-decimal pl-6 mb-3" {...props} />,
                    li: ({ node, ...props }) => (
                        <li className="mb-1" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </li>
                    ),
                    blockquote: ({ node, ...props }) => (
                        <blockquote className="border-l-4 border-gray-300 pl-4 italic my-3" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </blockquote>
                    ),
                    pre: ({ node, ...props }) => (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto my-3" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </pre>
                    ),
                    a: ({ node, ...props }) => (
                        <a className="text-blue-600 hover:underline" rel="noopener noreferrer" target="_blank" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </a>
                    ),
                    table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-3">
                            <table className="min-w-full border-collapse border border-gray-300" {...props} />
                        </div>
                    ),
                    th: ({ node, ...props }) => (
                        <th className="border border-gray-300 px-4 py-2 bg-gray-100 dark:bg-gray-800" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </th>
                    ),
                    td: ({ node, ...props }) => (
                        <td className="border border-gray-300 px-4 py-2" {...props}>
                            {renderNodeWithTopicReferences(props.children)}
                        </td>
                    ),
                    // 灰色分割线
                    hr: ({ node, ...props }) => <hr className="my-3 border-gray-300" {...props} />
                }}
                remarkPlugins={[remarkGfm]}
            >
                {content}
            </ReactMarkdown>

            {showCopyButton && (
                <div className="flex justify-end mt-4">
                    <Button color="primary" size="sm" startContent={<Copy size={16} />} variant="flat" onPress={handleCopyContent}>
                        复制全文
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MarkdownRenderer;
