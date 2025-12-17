import API_BASE_URL from "./constants/baseUrl";

import fetchWrapper from "@/util/fetchWrapper";

// 兴趣得分结果接口
interface InterestScoreResult {
    topicId: string;
    score: number | null;
}

/**
 * 获取话题的兴趣得分
 * @param topicId 话题ID数组
 * @returns 兴趣得分结果，如果对应的topicid不存在 或者 topicid存在但是没有对应的分数，那么该项目对应的score为null
 */
export const getInterestScoreResults = async (topicIds: string[]): Promise<ApiResponse<InterestScoreResult[]>> => {
    // 请求参数过大，使用post请求
    const response = await fetchWrapper(`${API_BASE_URL}/api/interest-score-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds })
    });

    return response.json();
};
