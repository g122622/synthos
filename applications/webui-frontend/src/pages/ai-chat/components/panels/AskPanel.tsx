/**
 * 问答结果面板
 */
import type React from "react";
import type { AskResponse } from "@/api/ragApi";

import { Button } from "@heroui/react";
import { Spinner } from "@heroui/spinner";
import { Download } from "lucide-react";
import domtoimage from "dom-to-image";
import { motion } from "framer-motion";

import ReferenceList from "../ReferenceList";

import MarkdownRenderer from "@/components/MarkdownRenderer";

interface AskPanelProps {
    askResponse: AskResponse;
    askLoading: boolean;
    currentSessionIsFailed: boolean;
    currentSessionFailReason: string;
    favoriteTopics: Record<string, boolean>;
    readTopics: Record<string, boolean>;
    theme: string;
    answerCardRef: React.RefObject<HTMLDivElement>;
    onMarkAsRead: (topicId: string) => void;
    onToggleFavorite: (topicId: string) => void;
}

export default function AskPanel({
    askResponse,
    askLoading,
    currentSessionIsFailed,
    currentSessionFailReason,
    favoriteTopics,
    readTopics,
    theme,
    answerCardRef,
    onMarkAsRead,
    onToggleFavorite
}: AskPanelProps) {
    const handleSaveAsImage = async () => {
        if (!answerCardRef.current) {
            return;
        }

        try {
            answerCardRef.current.style.padding = "20px"; // 增加内边距，提升观感

            const dataUrl = await domtoimage.toPng(answerCardRef.current, {
                quality: 1.0,
                bgcolor: theme === "dark" ? "#1e1e1e" : "#ffffff"
            });

            const link = document.createElement("a");

            link.download = `AI回答_${new Date().getTime()}.png`;
            link.href = dataUrl;
            link.click();
        } catch (error) {
            console.error("保存图片失败:", error);
        } finally {
            if (answerCardRef.current) {
                answerCardRef.current.style.padding = ""; // 恢复原始内边距
            }
        }
    };

    return (
        <motion.div animate={{ opacity: 1, y: 0 }} className="space-y-4" initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.4 }}>
            {currentSessionIsFailed && (
                <div className="rounded-md border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger">
                    <div className="font-medium">该会话生成失败（已保存部分内容）</div>
                    {currentSessionFailReason && <div className="mt-1 text-xs opacity-90">失败原因：{currentSessionFailReason}</div>}
                </div>
            )}

            {askLoading && (
                <div className="flex items-center gap-2 text-default-500 text-sm">
                    <Spinner color="primary" size="sm" />
                    <span>流式输出中...</span>
                </div>
            )}

            <MarkdownRenderer
                content={askResponse.answer}
                showCopyButton={false}
                topicReferenceOptions={{
                    references: askResponse.references,
                    favoriteTopics,
                    readTopics,
                    onMarkAsRead,
                    onToggleFavorite
                }}
            />

            <div className="flex gap-2 mt-4">
                <Button color="primary" size="sm" startContent={<Download className="w-4 h-4" />} variant="flat" onClick={handleSaveAsImage}>
                    保存为图片
                </Button>
            </div>

            <ReferenceList favoriteTopics={favoriteTopics} readTopics={readTopics} references={askResponse.references} onMarkAsRead={onMarkAsRead} onToggleFavorite={onToggleFavorite} />
        </motion.div>
    );
}
