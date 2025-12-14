import React from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Copy } from "lucide-react";

import { Notification } from "@/util/Notification";

interface MarkdownRendererProps {
    content: string;
    showCopyButton?: boolean;
    className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
    content, 
    showCopyButton = true,
    className = ""
}) => {
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

    return (
        <div className={`prose prose-sm max-w-none dark:prose-invert ${className}`}>
            <ReactMarkdown
                components={{
                    // 自定义组件样式
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-6 mb-4" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-5 mb-3" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-4 mb-2" {...props} />,
                    p: ({node, ...props}) => <p className="mb-3" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-6 mb-3" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-6 mb-3" {...props} />,
                    li: ({node, ...props}) => <li className="mb-1" {...props} />,
                    blockquote: ({node, ...props}) => (
                        <blockquote className="border-l-4 border-gray-300 pl-4 italic my-3" {...props} />
                    ),
                    code: ({inline, node, ...props}) => 
                        inline ? (
                            <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded text-sm" {...props} />
                        ) : (
                            <code {...props} />
                        ),
                    pre: ({node, ...props}) => (
                        <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-x-auto my-3" {...props} />
                    ),
                    a: ({node, ...props}) => (
                        <a className="text-blue-600 hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
                    ),
                    table: ({node, ...props}) => (
                        <div className="overflow-x-auto my-3">
                            <table className="min-w-full border-collapse border border-gray-300" {...props} />
                        </div>
                    ),
                    th: ({node, ...props}) => (
                        <th className="border border-gray-300 px-4 py-2 bg-gray-100 dark:bg-gray-800" {...props} />
                    ),
                    td: ({node, ...props}) => (
                        <td className="border border-gray-300 px-4 py-2" {...props} />
                    ),
                }}
            >
                {content}
            </ReactMarkdown>
            
            {showCopyButton && (
                <div className="flex justify-end mt-4">
                    <Button
                        color="primary"
                        variant="flat"
                        size="sm"
                        startContent={<Copy size={16} />}
                        onPress={handleCopyContent}
                    >
                        复制全文
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MarkdownRenderer;