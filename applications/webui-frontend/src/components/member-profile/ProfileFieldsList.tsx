import type React from "react";
import type { MemberProfileContent } from "@/types/memberProfile";

import { FIELDS } from "./profileFields";

interface ProfileFieldsListProps {
    content: MemberProfileContent;
}

/**
 * 紧凑单列渲染六字段画像（弹窗体用，无 Card 外壳）
 * null 字段显示"信息不足"
 */
const ProfileFieldsList: React.FC<ProfileFieldsListProps> = ({ content }) => {
    return (
        <div className="flex flex-col gap-2">
            {FIELDS.map(field => {
                const value = content[field.key];

                return (
                    <div key={field.key} className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5 text-default-500 text-xs">
                            {field.icon}
                            <span>{field.label}</span>
                        </div>
                        {value ? <p className="text-default-800 text-sm whitespace-pre-wrap break-words">{value}</p> : <p className="text-default-400 text-sm italic">信息不足</p>}
                    </div>
                );
            })}
        </div>
    );
};

export default ProfileFieldsList;
