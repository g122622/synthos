// 通用响应格式
interface BaseResponse {
    success: boolean;
}

interface SuccessResponse<T> extends BaseResponse {
    data: T;
}

interface ErrorResponse extends BaseResponse {
    message: string;
}

interface ApiResponse<T> {
    success: boolean;
    data: T;
    message: string;
}
