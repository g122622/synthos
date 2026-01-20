/**
 * AI 问答输入栏
 */
import { Button, Checkbox, cn } from "@heroui/react";
import { Input, Textarea } from "@heroui/input";
import { Send } from "lucide-react";

interface AskInputBarProps {
    question: string;
    topK: number;
    enableQueryRewriter: boolean;
    askLoading: boolean;
    onQuestionChange: (value: string) => void;
    onTopKChange: (value: number) => void;
    onEnableQueryRewriterChange: (value: boolean) => void;
    onAsk: () => void;
}

export default function AskInputBar({ question, topK, enableQueryRewriter, askLoading, onQuestionChange, onTopKChange, onEnableQueryRewriterChange, onAsk }: AskInputBarProps) {
    return (
        <form
            className={cn("relative w-full rounded-medium bg-default-100", "flex flex-col items-start", "transition-border border-2 border-default-300 focus-within:border-primary")}
            onSubmit={e => {
                e.preventDefault();
                onAsk();
            }}
        >
            <Textarea
                className="w-full"
                classNames={{
                    inputWrapper: "!bg-transparent shadow-none",
                    input: "pt-2 pl-3 pb-12 !pr-3 text-medium"
                }}
                maxRows={5}
                minRows={2}
                placeholder="输入你的问题，如：React 18 有哪些新特性？群友们是怎么看的？"
                value={question}
                variant="flat"
                onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        onAsk();
                    }
                }}
                onValueChange={onQuestionChange}
            />

            <div className="flex w-full items-center justify-between px-3 pb-3">
                <div className="flex items-center gap-2">
                    Top-K:
                    <Input className="w-35" max={100} min={1} size="sm" type="number" value={topK.toString()} variant="bordered" onChange={e => onTopKChange(parseInt(e.target.value) || 100)} />
                    <Checkbox className="ml-2" isSelected={enableQueryRewriter} size="md" onValueChange={onEnableQueryRewriterChange}>
                        查询扩展
                    </Checkbox>
                </div>

                <div className="flex items-center gap-2">
                    <div className="text-xs text-default-400">{question.length > 0 ? `${question.length} 字符` : ""}</div>
                    <Button isIconOnly color={question.trim() ? "primary" : "default"} isDisabled={!question.trim() || askLoading} isLoading={askLoading} size="sm" type="submit">
                        <Send className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </form>
    );
}
