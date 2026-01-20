import { useEffect, useState } from "react";

/**
 * 移动端布局检测与抽屉状态
 */
export function useMobileLayout() {
    const [isMobile, setIsMobile] = useState(false);
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };

        checkMobile();
        window.addEventListener("resize", checkMobile);

        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return { isMobile, mobileDrawerOpen, setMobileDrawerOpen };
}
