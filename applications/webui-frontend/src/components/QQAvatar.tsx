import React from "react";

/**
 * QQ头像类型
 * - group: QQ群头像
 * - user: QQ用户头像
 */
type QQAvatarType = "group" | "user";

interface QQAvatarProps {
    /** QQ头像类型：group 群头像，user 用户头像 */
    type: QQAvatarType;
    /** QQ号或群号 */
    qqId: string;
    /** 图片尺寸类名，默认为 "w-6 h-6" */
    sizeClassName?: string;
    /** 额外的CSS类名 */
    className?: string;
    /** alt文本 */
    alt?: string;
}

/** 默认占位图（SVG格式的用户图标） */
const DEFAULT_AVATAR_PLACEHOLDER =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23ccc'%3E%3Cpath d='M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z'/%3E%3C/svg%3E";

/**
 * 根据类型和QQ号生成头像URL
 * 使用相对路径指向同源后端接口，由后端统一回源腾讯并做磁盘缓存。
 * 必须用相对路径（不拼 API_BASE_URL）才能让浏览器视为同源，
 * 否则 dom-to-image 截图时跨域图片无法进入 canvas。
 * @param type 头像类型
 * @param qqId QQ号或群号
 * @returns 头像URL
 */
function getAvatarUrl(type: QQAvatarType, qqId: string): string {
    return `/api/qq-avatar?type=${type}&qqId=${encodeURIComponent(qqId)}`;
}

/**
 * QQ头像组件
 * 支持显示QQ群头像和QQ用户头像，带有错误处理和默认占位图
 */
const QQAvatar: React.FC<QQAvatarProps> = ({ type, qqId, sizeClassName = "w-6 h-6", className = "", alt }) => {
    // 根据类型生成默认alt文本
    const defaultAlt = type === "group" ? "群头像" : "用户头像";

    const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
        const target = e.target as HTMLImageElement;

        target.onerror = null;
        target.src = DEFAULT_AVATAR_PLACEHOLDER;
    };

    return <img alt={alt || defaultAlt} className={`${sizeClassName} rounded-full ${className}`.trim()} src={getAvatarUrl(type, qqId)} onError={handleError} style={{ display: "inline" }} />;
};

export default QQAvatar;
export type { QQAvatarType, QQAvatarProps };
