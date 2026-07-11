/**
 * 群友个人画像相关契约
 * 画像以 senderId（QQ号）为主键，聚合该群友参与的所有话题摘要后由 LLM 生成结构化总结
 */

/**
 * 画像内容（六字段结构化总结）
 * 某字段信息不足时为 null，由 LLM 判断
 */
export interface MemberProfileContent {
    school: string | null; // 学校/教育背景
    company: string | null; // 公司/工作单位
    domain: string | null; // 专业领域/研究方向
    experience: string | null; // 经历（科研/实习/求职等）
    interests: string | null; // 兴趣/关注点
    communicationStyle: string | null; // 沟通风格
}

/**
 * 群友画像记录（对应 member_profiles 表一行）
 */
export interface MemberProfile {
    senderId: string; // QQ号，主键
    nickname: string | null; // 展示用昵称，仅展示不参与反查
    profileJson: string; // MemberProfileContent 的 JSON 字符串
    modelName: string; // 生成所用模型名
    topicCount: number; // 本次聚合依据的话题数
    createdAt: number; // 创建时间，毫秒级时间戳
    updatedAt: number; // 更新时间，毫秒级时间戳
}
