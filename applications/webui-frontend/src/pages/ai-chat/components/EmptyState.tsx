/**
 * 空状态组件
 */
import { motion } from "framer-motion";

type EmptyStateMode = "ask" | "search";

interface EmptyStateProps {
    mode: EmptyStateMode;
}

export default function EmptyState({ mode }: EmptyStateProps) {
    if (mode === "ask") {
        return (
            <motion.div
                animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
                className="text-center py-12"
                initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
            >
                <div
                    className="
                        bg-gradient-to-r from-warning-600 via-primary-600 to-secondary-600
                        bg-[length:200%_auto] animate-[gradient_3s_ease-in-out_infinite]
                        bg-clip-text text-transparent
                        text-3xl md:text-4xl font-bold mb-4
                    "
                    style={{
                        backgroundSize: "200% auto",
                        animation: "gradient 3s ease-in-out infinite"
                    }}
                >
                    开始提问，获取智能回答
                </div>
                <p className="text-default-500 text-sm md:text-base">基于群聊记录，AI 将为您提供准确的答案和参考来源</p>
            </motion.div>
        );
    }

    return (
        <motion.div
            animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            className="text-center py-12"
            initial={{ opacity: 0, filter: "blur(10px)", y: 20 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
        >
            <div
                className="
                    bg-gradient-to-r from-primary-600 via-secondary-600 to-success-600
                    bg-[length:200%_auto] animate-[gradient_3s_ease-in-out_infinite]
                    bg-clip-text text-transparent
                    text-3xl md:text-4xl font-bold mb-4
                "
                style={{
                    backgroundSize: "200% auto",
                    animation: "gradient 3s ease-in-out infinite"
                }}
            >
                语义搜索
            </div>
            <p className="text-default-500 text-sm md:text-base">输入关键词或自然语言描述，找出语义最相关的群聊话题</p>
        </motion.div>
    );
}
