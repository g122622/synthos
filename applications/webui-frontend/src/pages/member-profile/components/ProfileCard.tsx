import type React from "react";
import type { MemberProfileContent } from "@/types/memberProfile";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Chip } from "@heroui/chip";
import { GraduationCap, Building2, Compass, Briefcase, Heart, MessageSquare } from "lucide-react";

interface ProfileCardProps {
    content: MemberProfileContent;
    modelName?: string;
    topicCount?: number;
}

// 六个维度的元信息：标签、图标、对应字段
const FIELDS: Array<{ key: keyof MemberProfileContent; label: string; icon: React.ReactNode }> = [
    { key: "school", label: "学校/教育", icon: <GraduationCap size={18} /> },
    { key: "company", label: "公司/单位", icon: <Building2 size={18} /> },
    { key: "domain", label: "专业领域", icon: <Compass size={18} /> },
    { key: "experience", label: "经历", icon: <Briefcase size={18} /> },
    { key: "interests", label: "兴趣/关注", icon: <Heart size={18} /> },
    { key: "communicationStyle", label: "沟通风格", icon: <MessageSquare size={18} /> }
];

const ProfileCard: React.FC<ProfileCardProps> = ({ content, modelName, topicCount }) => {
    return (
        <Card className="border border-default-200">
            <CardHeader className="flex flex-col gap-1">
                <h3 className="text-lg font-bold">群友画像</h3>
                <div className="flex flex-wrap gap-2">
                    {modelName && (
                        <Chip size="sm" variant="flat">
                            {modelName}
                        </Chip>
                    )}
                    {topicCount !== undefined && (
                        <Chip color="primary" size="sm" variant="flat">
                            依据 {topicCount} 个话题
                        </Chip>
                    )}
                </div>
            </CardHeader>
            <CardBody>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FIELDS.map(field => {
                        const value = content[field.key];

                        return (
                            <div key={field.key} className="flex flex-col gap-1 p-3 rounded-lg bg-default-50">
                                <div className="flex items-center gap-2 text-default-500 text-sm">
                                    {field.icon}
                                    <span>{field.label}</span>
                                </div>
                                {value ? <p className="text-default-800 text-sm whitespace-pre-wrap break-words">{value}</p> : <p className="text-default-400 text-sm italic">信息不足</p>}
                            </div>
                        );
                    })}
                </div>
            </CardBody>
        </Card>
    );
};

export default ProfileCard;
