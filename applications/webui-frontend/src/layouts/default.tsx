import { Link } from "@heroui/link";
import { KeepAlive } from "react-activation";
import { useLocation, useOutlet } from "react-router-dom";

import { Navbar } from "@/components/navbar";

// 纳入 keep-alive 的路径前缀白名单。
// 注意：/member-profile/:qqId（带 qqId 的详情页）刻意不在内——
// QQ 号无界增长会撑爆缓存，且每次进入都会按 qqId 重新拉取，无需缓存。
const KEEP_ALIVE_PREFIXES = ["/", "/chat-messages", "/latest-topics", "/member-profile", "/reports", "/ai-chat", "/groups", "/config", "/system-monitor"];

// 带参的 member-profile 详情页不缓存：/member-profile/12345
function shouldKeepAlive(pathname: string): boolean {
    // 精确匹配 /member-profile 才缓存；/member-profile/:qqId 直接放行
    if (pathname.startsWith("/member-profile/")) {
        return false;
    }

    return KEEP_ALIVE_PREFIXES.some(prefix => (prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(prefix + "/")));
}

export default function DefaultLayout() {
    const location = useLocation();
    const outlet = useOutlet();

    // 始终挂载 <KeepAlive>，通过 when 控制是否缓存：
    // - 顶栏各标签页（白名单内）when=true，切换时保留状态/滚动
    // - /member-profile/:qqId 等带参详情页 when=false，正常挂载不缓存，避免按 QQ 号撑爆缓存
    const keepAlive = shouldKeepAlive(location.pathname);

    return (
        <div className="relative flex flex-col h-screen">
            <Navbar />
            <main className="container mx-auto flex-grow" style={{ maxWidth: "calc(100% - 100px)" }}>
                <KeepAlive cacheKey={location.pathname} when={keepAlive}>
                    {outlet}
                </KeepAlive>
            </main>
            <footer className="w-full items-center justify-center py-3 hidden md:flex">
                <Link isExternal className="flex items-center gap-1 text-current" href="https://heroui.com" title="heroui.com homepage">
                    <span className="text-default-600">Powered by</span>
                    <p className="text-primary">HeroUI</p>
                </Link>
                <span className="text-default-600 ml-9">Made with ❤️ by GY.</span>
            </footer>
        </div>
    );
}
