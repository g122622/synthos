/**
 * 群友画像 API 接口
 * 用于查询缓存画像、反查依据话题、生成画像（普通 POST，非流式）
 */
import type { MemberProfile, GenerateMemberProfileRequest } from "@/types/memberProfile";
import type { AIDigestResult } from "@/types/topic";
import type { ApiResponse } from "@/types/api";

import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";
import { mockConfig } from "@/config/mock";
import { mockGetMemberProfile, mockGetContributorTopics, mockGenerateMemberProfile } from "@/mock/memberProfileMock";

// 导出类型供 mock 和组件使用
export type { MemberProfile, GenerateMemberProfileRequest };

/**
 * 查询缓存的群友画像
 * @param senderId 群友 QQ号
 * @returns 命中的画像记录，未命中返回 null
 */
export const getMemberProfile = async (senderId: string): Promise<ApiResponse<MemberProfile | null>> => {
    if (mockConfig.memberProfile) {
        return mockGetMemberProfile(senderId);
    }

    const params = new URLSearchParams({ senderId });
    const response = await fetchWrapper(`${API_BASE_URL}/api/member-profile?${params}`);

    return response.json();
};

/**
 * 反查该群友参与的所有话题（画像依据）
 * @param senderId 群友 QQ号
 */
export const getContributorTopics = async (senderId: string): Promise<ApiResponse<AIDigestResult[]>> => {
    if (mockConfig.memberProfile) {
        return mockGetContributorTopics(senderId);
    }

    const params = new URLSearchParams({ senderId });
    const response = await fetchWrapper(`${API_BASE_URL}/api/member-profile/topics?${params}`);

    return response.json();
};

/**
 * 生成群友画像（非流式，直接返回完整画像）
 * @param request 请求参数（senderId + 可选 nickname）
 */
export const generateMemberProfile = async (request: GenerateMemberProfileRequest): Promise<ApiResponse<MemberProfile | null>> => {
    if (mockConfig.memberProfile) {
        return mockGenerateMemberProfile(request);
    }

    const response = await fetchWrapper(`${API_BASE_URL}/api/member-profile/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request)
    });

    return response.json();
};
