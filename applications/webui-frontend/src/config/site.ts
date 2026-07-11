export type SiteConfig = typeof siteConfig;

export const siteConfig = {
    name: "Synthos WebUI",
    description: "QQ聊天记录全链路总结功能",
    navItems: [
        {
            label: "🏠首页",
            href: "/"
        },
        {
            label: "💬聊天记录",
            href: "/chat-messages"
        },
        // {
        //     label: "🤖摘要结果",
        //     href: "/ai-digest"
        // },
        {
            label: "🔥最新话题",
            href: "/latest-topics"
        },
        {
            label: "👤群友画像",
            href: "/member-profile"
        },
        {
            label: "📰日报中心",
            href: "/reports"
        },
        {
            label: "🔍智能问答",
            href: "/ai-chat"
        },
        {
            label: "⚙️群组管理",
            href: "/groups"
        },
        {
            label: "🛠️配置面板",
            href: "/config"
        },
        {
            label: "📊系统监控",
            href: "/system-monitor"
        }
    ],
    navMenuItems: [
        {
            label: "🏠首页",
            href: "/"
        },
        {
            label: "💬聊天记录",
            href: "/chat-messages"
        },
        // {
        //     label: "🤖摘要结果",
        //     href: "/ai-digest"
        // },
        {
            label: "🔥最新话题",
            href: "/latest-topics"
        },
        {
            label: "👤群友画像",
            href: "/member-profile"
        },
        {
            label: "📰日报中心",
            href: "/reports"
        },
        {
            label: "🔍智能问答",
            href: "/ai-chat"
        },
        {
            label: "⚙️群组管理",
            href: "/groups"
        },
        {
            label: "🛠️配置面板",
            href: "/config"
        },
        {
            label: "📊系统监控",
            href: "/system-monitor"
        }
    ],
    links: {
        github: "https://github.com/heroui-inc/heroui",
        twitter: "https://twitter.com/hero_ui",
        docs: "https://heroui.com",
        discord: "https://discord.gg/9b6yyZKmH4",
        sponsor: "https://patreon.com/jrgarciadev"
    }
};
