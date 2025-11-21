import React, { useState, useEffect } from "react";
import { Popover, PopoverTrigger, PopoverContent, Button } from "@heroui/react"; // 假设你用的是 Chakra UI
import setViewportScale from "@/util/setViewportScale";

// 自定义 Hook：监听媒体查询
function useMediaQuery(query: string): boolean {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const media = window.matchMedia(query);

        if (media.matches !== matches) {
            setMatches(media.matches);
        }

        const listener = () => setMatches(media.matches);

        media.addEventListener("change", listener);

        return () => media.removeEventListener("change", listener);
    }, [matches, query]);

    return matches;
}

interface ResponsivePopoverProps {
    buttonText: string;
    children: React.ReactNode;
}

const ResponsivePopover: React.FC<ResponsivePopoverProps> = ({ buttonText, children }) => {
    const isSmallScreen = useMediaQuery("(max-width: 1023px)");

    if (!isSmallScreen) {
        return <>{children}</>;
    }

    setViewportScale(90);

    return (
        <Popover placement="bottom">
            <PopoverTrigger>
                <Button color="primary">{buttonText}</Button>
            </PopoverTrigger>
            <PopoverContent>{children}</PopoverContent>
        </Popover>
    );
};

export default ResponsivePopover;
