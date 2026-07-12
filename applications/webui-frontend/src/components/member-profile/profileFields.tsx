import type React from "react";
import type { MemberProfileContent } from "@/types/memberProfile";

import { GraduationCap, Building2, Compass, Briefcase, Heart, MessageSquare } from "lucide-react";

/**
 * 六个画像维度的元信息：字段键、标签、图标
 * 画像页 ProfileCard 与弹窗 ProfileFieldsList 共用
 */
export const FIELDS: Array<{ key: keyof MemberProfileContent; label: string; icon: React.ReactNode }> = [
    { key: "school", label: "学校/教育", icon: <GraduationCap size={18} /> },
    { key: "company", label: "公司/单位", icon: <Building2 size={18} /> },
    { key: "domain", label: "专业领域", icon: <Compass size={18} /> },
    { key: "experience", label: "经历", icon: <Briefcase size={18} /> },
    { key: "interests", label: "兴趣/关注", icon: <Heart size={18} /> },
    { key: "communicationStyle", label: "沟通风格", icon: <MessageSquare size={18} /> }
];
