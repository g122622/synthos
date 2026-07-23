import { Link, Tooltip } from "@heroui/react";

import MemberProfilePopover from "@/components/member-profile/MemberProfilePopover";
import AnchorIcon from "./AnchorIcon";
import ContributorChip from "./ContributorChip";
import { isLikelyQQId } from "@/util/isLikelyQQId";

interface EnhancedDetailProps {
    detail: string;
    contributors: string[];
    /** 参与者昵称 → QQ号 映射，用于在昵称 chip 前展示头像；缺失的昵称不展示头像 */
    contributorToQQId?: Map<string, string>;
}

// 渲染带有高亮和链接的详情文本
const EnhancedDetail: React.FC<EnhancedDetailProps> = ({ detail, contributors, contributorToQQId }) => {
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
                // 如果是参与者名称，渲染为昵称前带头像的 Chip
                const qqId = contributorToQQId?.get(part);
                const canNavigate = Boolean(qqId) && isLikelyQQId(qqId as string);

                const chip = <ContributorChip chipClassName="mx-1 inline-flex items-center gap-1" nickname={part} qqId={qqId} sizeClassName="w-5 h-5 mr-1 mb-0" />;

                if (canNavigate) {
                    // 有 QQ号：点击弹出画像 Popover
                    finalParts.push(
                        <MemberProfilePopover key={`name-${partIndex}`} nickname={part} qqId={qqId as string}>
                            {chip}
                        </MemberProfilePopover>
                    );
                } else {
                    // 无 QQ号：Tooltip 提示，不弹窗
                    finalParts.push(
                        <Tooltip key={`name-${partIndex}`} content="该群友无QQ号，无法生成画像" placement="top">
                            {chip}
                        </Tooltip>
                    );
                }
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
