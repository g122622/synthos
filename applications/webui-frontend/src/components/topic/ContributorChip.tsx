import { forwardRef } from "react";
import type { ComponentProps } from "react";
import { Chip } from "@heroui/chip";

import QQAvatar from "@/components/QQAvatar";
import { isLikelyQQId } from "@/util/isLikelyQQId";

import { useAvatarColor } from "./hooks/useAvatarColor";

/**
 * 继承 HeroUI Chip 的全部 props（含 onPress/onClick/onKeyDown 等），
 * 这样 PopoverTrigger/Tooltip clone 注入的交互回调能被透传到内部 Chip。
 */
type ContributorChipProps = Omit<ComponentProps<typeof Chip>, "children"> & {
    /** 贡献者昵称 */
    nickname: string;
    /** QQ 号；缺失或非法时不展示头像、Chip 用兜底色 */
    qqId?: string | null;
    /** 头像尺寸类名，传给内部 QQAvatar */
    sizeClassName?: string;
    /** Chip 容器类名（覆盖默认 className） */
    chipClassName?: string;
};

/**
 * 贡献者昵称 Chip（两处调用点共用）。
 * 配色由头像像素采样决定（见 useAvatarColor）；不含 MemberProfilePopover/Tooltip 包裹——
 * 该包裹属调用点的上下文关注点，由调用点自行决定。
 *
 * 用 forwardRef + 继承 Chip props 是因为 MemberProfilePopover 的 PopoverTrigger
 * 会 clone 子元素并下发 ref 与交互回调（onPress/onClick）：ref 需 forwardRef 接收，
 * 交互回调需通过 ...rest 透传给内部 Chip，否则点击无法打开 Popover。
 */
const ContributorChip = forwardRef<HTMLDivElement, ContributorChipProps>(({ nickname, qqId, sizeClassName, chipClassName, className, ...rest }, ref) => {
    const hasValidQQ = Boolean(qqId) && isLikelyQQId(qqId as string);
    const { backgroundColor, color } = useAvatarColor(hasValidQQ ? (qqId as string) : undefined);

    return (
        <Chip ref={ref} className={chipClassName ?? className ?? "mx-1 inline-flex items-center gap-1"} size="sm" style={{ backgroundColor, color, fontWeight: "bold" }} variant="flat" {...rest}>
            {hasValidQQ ? <QQAvatar qqId={qqId as string} sizeClassName={sizeClassName} type="user" /> : null}
            {nickname}
        </Chip>
    );
});

ContributorChip.displayName = "ContributorChip";

export default ContributorChip;
