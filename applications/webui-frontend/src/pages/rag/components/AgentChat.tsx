/**
 * Agent 聊天组件
 * 显示 Agent 对话消息、工具调用过程、输入框
 */
import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button, Spinner, Textarea, Card, CardBody, Chip, cn } from "@heroui/react";
import { Send, Bot, User, Wrench } from "lucide-react";
import { motion } from "framer-motion";

import { agentAsk, AgentMessage, AgentAskRequest } from "@/api/agentApi";
import MarkdownRenderer from "@/components/MarkdownRenderer";

interface AgentChatProps {
    // 当前选中的对话ID
    conversationId?: string;
    // 会话ID
    sessionId?: string;
}

/**
 * Agent 消息项组件
 */
interface AgentMessageItemProps {
    message: AgentMessage;
}

const AgentMessageItem: React.FC<AgentMessageItemProps> = ({ message }) => {
    const isUser = message.role === "user";

    return (
        <motion.div animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3 mb-6", isUser ? "flex-row-reverse" : "flex-row")} initial={{ opacity: 0, y: 20 }} transition={{ duration: 0.3 }}>
            {/* 头像 */}
            <div className={cn("flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center", isUser ? "bg-primary-100" : "bg-secondary-100")}>
                {isUser ? <User className="w-5 h-5 text-primary-600" /> : <Bot className="w-5 h-5 text-secondary-600" />}
            </div>

            {/* 消息内容 */}
            <div className={cn("flex-1 max-w-[80%]", isUser ? "text-right" : "text-left")}>
                <Card className={cn("shadow-sm", isUser ? "bg-primary-50" : "bg-default-50")}>
                    <CardBody className="p-4">
                        {isUser ? (
                            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        ) : (
                            <>
                                <MarkdownRenderer content={message.content} showCopyButton={false} />

                                {/* 工具使用信息 */}
                                {message.toolsUsed && message.toolsUsed.length > 0 && (
                                    <div className="mt-3 pt-3 border-t border-default-200">
                                        <div className="flex flex-wrap gap-2 items-center">
                                            <Wrench className="w-4 h-4 text-default-500" />
                                            <span className="text-xs text-default-500">使用的工具：</span>
                                            {message.toolsUsed.map((tool, idx) => (
                                                <Chip key={idx} color="secondary" size="sm" variant="flat">
                                                    {tool}
                                                </Chip>
                                            ))}
                                        </div>

                                        {message.toolRounds !== undefined && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs text-default-500">调用轮次: {message.toolRounds}</span>
                                            </div>
                                        )}

                                        {/* Token 使用统计 */}
                                        {message.tokenUsage && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <span className="text-xs text-default-500">
                                                    Token: {message.tokenUsage.promptTokens} + {message.tokenUsage.completionTokens} = {message.tokenUsage.totalTokens}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </CardBody>
                </Card>

                {/* 时间戳 */}
                <p className={cn("text-xs text-default-400 mt-1", isUser ? "text-right" : "text-left")}>{new Date(message.timestamp).toLocaleTimeString("zh-CN")}</p>
            </div>
        </motion.div>
    );
};

/**
 * Agent 聊天主组件
 */
export const AgentChat: React.FC<AgentChatProps> = ({ conversationId, sessionId }) => {
    // 消息列表
    const [messages, setMessages] = useState<AgentMessage[]>([]);
    // 输入内容
    const [inputValue, setInputValue] = useState("");
    // 加载状态
    const [loading, setLoading] = useState(false);
    // 当前对话ID
    const [currentConversationId, setCurrentConversationId] = useState<string | undefined>(conversationId);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 自动滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // 处理发送消息
    const handleSend = useCallback(async () => {
        if (!inputValue.trim() || loading) {
            return;
        }

        const userQuestion = inputValue.trim();

        setInputValue("");
        setLoading(true);

        // 添加用户消息
        const userMessage: AgentMessage = {
            id: `user_${Date.now()}`,
            conversationId: currentConversationId || "",
            role: "user",
            content: userQuestion,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);

        try {
            // 调用 Agent API
            const request: AgentAskRequest = {
                question: userQuestion,
                conversationId: currentConversationId,
                sessionId: sessionId,
                enabledTools: ["rag_search", "sql_query"],
                maxToolRounds: 5,
                temperature: 0.7,
                maxTokens: 2048
            };

            const response = await agentAsk(request);

            if (response.success && response.data) {
                const agentResponse = response.data;

                // 更新当前对话ID
                setCurrentConversationId(agentResponse.conversationId);

                // 添加 Agent 回复消息
                const assistantMessage: AgentMessage = {
                    id: agentResponse.messageId,
                    conversationId: agentResponse.conversationId,
                    role: "assistant",
                    content: agentResponse.content,
                    timestamp: Date.now(),
                    toolsUsed: agentResponse.toolsUsed,
                    toolRounds: agentResponse.toolRounds,
                    tokenUsage: agentResponse.totalUsage
                };

                setMessages(prev => [...prev, assistantMessage]);
            } else {
                // 显示错误消息
                const errorMessage: AgentMessage = {
                    id: `error_${Date.now()}`,
                    conversationId: currentConversationId || "",
                    role: "assistant",
                    content: `❌ 发生错误: ${response.message || "未知错误"}`,
                    timestamp: Date.now()
                };

                setMessages(prev => [...prev, errorMessage]);
            }
        } catch (error) {
            console.error("Agent 问答出错:", error);

            // 显示错误消息
            const errorMessage: AgentMessage = {
                id: `error_${Date.now()}`,
                conversationId: currentConversationId || "",
                role: "assistant",
                content: `❌ 网络错误: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    }, [inputValue, loading, currentConversationId, sessionId]);

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* 消息列表 */}
            <div className="flex-1 overflow-y-auto px-4 py-6">
                {messages.length === 0 ? (
                    <motion.div
                        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                        className="text-center py-12"
                        initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                    >
                        <div
                            className="
                                bg-gradient-to-r from-secondary-600 via-primary-600 to-warning-600
                                bg-[length:200%_auto] animate-[gradient_3s_ease-in-out_infinite]
                                bg-clip-text text-transparent
                                text-3xl md:text-4xl font-bold mb-4
                            "
                            style={{
                                backgroundSize: "200% auto",
                                animation: "gradient 3s ease-in-out infinite"
                            }}
                        >
                            智能 Agent 助手
                        </div>
                        <p className="text-default-500 text-sm md:text-base">我可以使用 RAG 搜索、SQL 查询等工具来回答你的问题</p>
                    </motion.div>
                ) : (
                    <>
                        {messages.map(msg => (
                            <AgentMessageItem key={msg.id} message={msg} />
                        ))}
                        <div ref={messagesEndRef} />
                    </>
                )}

                {/* 加载中提示 */}
                {loading && (
                    <motion.div animate={{ opacity: 1 }} className="flex items-center gap-3 mb-6" initial={{ opacity: 0 }} transition={{ duration: 0.3 }}>
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-secondary-100 flex items-center justify-center">
                            <Bot className="w-5 h-5 text-secondary-600" />
                        </div>
                        <Card className="bg-default-50 shadow-sm">
                            <CardBody className="p-4">
                                <div className="flex items-center gap-2">
                                    <Spinner color="secondary" size="sm" />
                                    <span className="text-sm text-default-500">思考中...</span>
                                </div>
                            </CardBody>
                        </Card>
                    </motion.div>
                )}
            </div>

            {/* 输入框 */}
            <div className="px-4 py-4 border-t border-default-200 bg-default-50">
                <div className="flex gap-2 items-end">
                    <Textarea
                        classNames={{
                            input: "resize-y"
                        }}
                        disabled={loading}
                        maxRows={6}
                        minRows={2}
                        placeholder="输入你的问题... (Enter 发送, Shift+Enter 换行)"
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <Button isIconOnly color="primary" disabled={!inputValue.trim() || loading} size="lg" onPress={handleSend}>
                        <Send className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        </div>
    );
};
