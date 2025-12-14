import { Chip } from "@heroui/chip";
import { Link } from "@heroui/react";

// 生成基于名称的颜色
const generateColorFromName = (name: string, isBackground: boolean = true): string => {
    const colors = [
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", 
        "#DDA0DD", "#98D8C8", "#FFD700", "#F8B500", "#6C5CE7"
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    const index = Math.abs(hash) % colors.length;
    return isBackground ? colors[index] + "20" : colors[index];
};

const AnchorIcon: React.FC = () => (
    <svg
        aria-hidden="true"
        fill="none"
        focusable="false"
        height="1em"
        role="presentation"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        viewBox="0 0 24 24"
        width="1em"
    >
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
);

// 创建一个组件来渲染带有高亮和链接的详情文本
const EnhancedDetail: React.FC<{ detail: string; contributors: string[] }> = ({ detail, contributors }) => {
    if (!detail) return <div className="text-default-700 mb-3">摘要正文为空，无法加载数据 😭😭😭</div>;

    // 创建正则表达式来匹配所有参与者名称
    const enhanceText = (text: string, names: string[]): React.ReactNode[] => {
        if (!text) return [];

        // 转义特殊字符并创建正则表达式来匹配参与者名称
        const escapedNames = names.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
        const nameRegex = new RegExp(`(${escapedNames.join("|")})`, "g");

        // 创建正则表达式来匹配URL链接
        const urlRegex = /((?:https?|ftp):\/\/[^\s\u0080-\uFFFF]+)/gi;

        // 先分割文本为名称和非名称部分
        const nameParts = text.split(nameRegex);

        // 对每个部分进一步处理链接
        const finalParts: React.ReactNode[] = [];

        nameParts.forEach((part, partIndex) => {
            // 检查这个部分是否是参与者名称
            const contributorIndex = names.indexOf(part);

            if (contributorIndex !== -1) {
                // 如果是参与者名称，直接返回Chip组件
                finalParts.push(
                    <Chip
                        key={`name-${partIndex}`}
                        className="mx-1"
                        size="sm"
                        style={{
                            backgroundColor: generateColorFromName(part),
                            color: generateColorFromName(part, false),
                            fontWeight: "bold"
                        }}
                        variant="flat"
                    >
                        {part}
                    </Chip>
                );
            } else {
                // 如果不是参与者名称，则处理链接
                if (typeof part === "string") {
                    const urlParts = part.split(urlRegex);

                    urlParts.forEach((urlPart, urlPartIndex) => {
                        // 检查这个部分是否是URL
                        if (urlPart.match(urlRegex)) {
                            finalParts.push(
                                <Link
                                    key={`link-${partIndex}-${urlPartIndex}`}
                                    isExternal
                                    showAnchorIcon
                                    anchorIcon={<AnchorIcon />}
                                    className="inline-flex items-center gap-1 mx-1"
                                    href={urlPart}
                                    underline="always"
                                >
                                    {urlPart}
                                </Link>
                            );
                        } else {
                            finalParts.push(urlPart);
                        }
                    });
                } else {
                    finalParts.push(part);
                }
            }
        });

        return finalParts;
    };

    return <div className="text-default-700 mb-3">{enhanceText(detail, contributors)}</div>;
};

export default EnhancedDetail;