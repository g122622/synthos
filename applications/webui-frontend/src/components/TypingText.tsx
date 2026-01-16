/**
 * 打字机效果组件
 * 用于逐字显示文本，模拟打字效果
 */
import { useState, useEffect } from "react";

interface TypingTextProps {
    /** 要显示的文本内容 */
    text: string;
    /** 打字速度（毫秒/字符），默认30ms */
    speed?: number;
    /** 是否启用打字效果，默认true */
    enabled?: boolean;
    /** 打字完成时的回调 */
    onComplete?: () => void;
    /** 自定义类名 */
    className?: string;
}

/**
 * 打字机效果组件
 * 支持逐字显示动画，适用于 AI 回复等场景
 */
const TypingText: React.FC<TypingTextProps> = ({ text, speed = 30, enabled = true, onComplete, className = "" }) => {
    const [displayedText, setDisplayedText] = useState("");
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // 如果禁用打字效果，直接显示全部文本
        if (!enabled) {
            setDisplayedText(text);
            setCurrentIndex(text.length);
            onComplete?.();

            return;
        }

        // 重置状态
        setDisplayedText("");
        setCurrentIndex(0);
    }, [text, enabled]);

    useEffect(() => {
        if (!enabled || currentIndex >= text.length) {
            if (currentIndex >= text.length && enabled) {
                onComplete?.();
            }

            return;
        }

        const timer = setTimeout(() => {
            setDisplayedText(text.slice(0, currentIndex + 1));
            setCurrentIndex(currentIndex + 1);
        }, speed);

        return () => clearTimeout(timer);
    }, [currentIndex, text, speed, enabled, onComplete]);

    return <span className={className}>{displayedText}</span>;
};

export default TypingText;
