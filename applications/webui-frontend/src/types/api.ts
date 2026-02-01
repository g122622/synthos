/**
 * API响应相关的类型定义
 */

/**
 * 基础响应格式
 */
export interface BaseResponse {
    success: boolean;
}

/**
 * 成功响应格式
 */
export interface SuccessResponse<T> extends BaseResponse {
    data: T;
}

/**
 * 错误响应格式
 */
export interface ErrorResponse extends BaseResponse {
    message: string;
}

/**
 * 通用API响应格式
 */
export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
}
