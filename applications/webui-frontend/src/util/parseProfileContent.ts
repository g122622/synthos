import type { MemberProfileContent } from "@/types/memberProfile";

/**
 * 解析画像 JSON 为 MemberProfileContent，解析失败返回 null
 */
export const parseProfileContent = (profileJson: string): MemberProfileContent | null => {
    try {
        const parsed = JSON.parse(profileJson) as MemberProfileContent;

        if (parsed && typeof parsed === "object") {
            return parsed;
        }

        return null;
    } catch {
        return null;
    }
};
