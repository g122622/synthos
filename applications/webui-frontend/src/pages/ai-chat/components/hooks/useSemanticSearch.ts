import { useCallback, useState } from "react";

import { DEFAULT_SEARCH_LIMIT } from "../../constants/constants";

import { search, type SearchResultItem } from "@/api/ragApi";

/**
 * 语义搜索状态与操作
 */
export function useSemanticSearch() {
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchLimit, setSearchLimit] = useState(DEFAULT_SEARCH_LIMIT);

    const handleSearch = useCallback(async () => {
        if (!searchQuery.trim()) {
            return;
        }

        setSearchLoading(true);
        try {
            const response = await search(searchQuery, searchLimit);

            if (response.success) {
                setSearchResults(response.data);
            } else {
                console.error("搜索失败:", response.message);
            }
        } catch (error) {
            console.error("搜索出错:", error);
        } finally {
            setSearchLoading(false);
        }
    }, [searchQuery, searchLimit]);

    const resetSearch = useCallback(() => {
        setSearchQuery("");
        setSearchResults([]);
        setSearchLoading(false);
        setSearchLimit(DEFAULT_SEARCH_LIMIT);
    }, []);

    return {
        searchQuery,
        setSearchQuery,
        searchResults,
        searchLoading,
        searchLimit,
        setSearchLimit,
        handleSearch,
        resetSearch
    };
}
