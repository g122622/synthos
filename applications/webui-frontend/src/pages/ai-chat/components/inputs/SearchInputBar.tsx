/**
 * 语义搜索输入栏
 */
import { Button, cn } from "@heroui/react";
import { Input } from "@heroui/input";
import { Search } from "lucide-react";

interface SearchInputBarProps {
    searchQuery: string;
    searchLimit: number;
    searchLoading: boolean;
    onSearchQueryChange: (value: string) => void;
    onSearchLimitChange: (value: number) => void;
    onSearch: () => void;
}

export default function SearchInputBar({ searchQuery, searchLimit, searchLoading, onSearchQueryChange, onSearchLimitChange, onSearch }: SearchInputBarProps) {
    return (
        <form
            className={cn("relative w-full rounded-medium bg-default-100", "flex flex-col items-start", "transition-border border-2 border-default-300 focus-within:border-primary")}
            onSubmit={e => {
                e.preventDefault();
                onSearch();
            }}
        >
            <Input
                className="w-full"
                classNames={{
                    inputWrapper: "!bg-transparent shadow-none",
                    input: "pt-3 pl-3 pb-3 !pr-3 text-medium"
                }}
                placeholder="输入搜索内容，如：React 性能优化"
                startContent={<Search className="w-5 h-5 text-default-400" />}
                value={searchQuery}
                variant="flat"
                onKeyDown={e => e.key === "Enter" && onSearch()}
                onValueChange={onSearchQueryChange}
            />

            <div className="flex w-full items-center justify-between px-3 pb-3 pt-2">
                <div className="flex items-center gap-2">
                    <Input
                        className="w-28"
                        label="结果数量"
                        max={50}
                        min={1}
                        size="sm"
                        type="number"
                        value={searchLimit.toString()}
                        variant="bordered"
                        onChange={e => onSearchLimitChange(parseInt(e.target.value) || 10)}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button isIconOnly color={searchQuery.trim() ? "primary" : "default"} isDisabled={!searchQuery.trim() || searchLoading} isLoading={searchLoading} size="sm" type="submit">
                        <Search className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </form>
    );
}
