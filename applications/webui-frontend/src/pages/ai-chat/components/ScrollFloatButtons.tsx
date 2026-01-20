/**
 * 右侧滚动悬浮按钮
 */
import { Button } from "@heroui/react";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ScrollFloatButtonsProps {
    onScrollToTop: () => void;
    onScrollToBottom: () => void;
}

export default function ScrollFloatButtons({ onScrollToTop, onScrollToBottom }: ScrollFloatButtonsProps) {
    return (
        <div className="fixed right-4 top-1/2 transform -translate-y-1/2 flex flex-col gap-2 z-20">
            <Button isIconOnly className="bg-default-100 hover:bg-default-200 shadow-lg" size="sm" variant="flat" onClick={onScrollToTop}>
                <ChevronUp className="w-4 h-4" />
            </Button>
            <Button isIconOnly className="bg-default-100 hover:bg-default-200 shadow-lg" size="sm" variant="flat" onClick={onScrollToBottom}>
                <ChevronDown className="w-4 h-4" />
            </Button>
        </div>
    );
}
