import { useEffect, useState } from "react";

import { AVATAR_FALLBACK_COLORS, getAvatarColorPair, subscribeAvatarColor, type ChipColorPair } from "@/util/avatarColor";
import { isLikelyQQId } from "@/util/isLikelyQQId";

/**
 * 贡献者 Chip 配色 hook：按 qqId 采样头像主色，首帧返回兜底色，采样完成后重渲染切换。
 *
 * - qqId 为空或非法（非纯数字）→ 同步返回兜底，不采样不订阅。
 * - 否则首帧读缓存（或兜底，并副作用启动采样），订阅解析事件，resolve 后切换。
 * - qqId 变化时重新订阅；卸载时取消订阅，避免 setState-after-unmount。
 */
export function useAvatarColor(qqId: string | undefined | null): ChipColorPair {
    const valid = Boolean(qqId) && isLikelyQQId(qqId as string);
    const effectiveQqId = valid ? (qqId as string) : "";

    const [colors, setColors] = useState<ChipColorPair>(() => (effectiveQqId ? getAvatarColorPair(effectiveQqId) : AVATAR_FALLBACK_COLORS));

    useEffect(() => {
        if (!effectiveQqId) {
            return;
        }

        // 订阅前先同步一次，避免错过在 useState 初始化与 effect 之间已完成采样的情况
        setColors(getAvatarColorPair(effectiveQqId));

        let mounted = true;

        const unsubscribe = subscribeAvatarColor(effectiveQqId, () => {
            if (mounted) {
                setColors(getAvatarColorPair(effectiveQqId));
            }
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [effectiveQqId]);

    return colors;
}
