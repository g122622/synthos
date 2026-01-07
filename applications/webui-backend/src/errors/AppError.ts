/**
 * 应用错误基类
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;

    constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;

        // 确保正确的原型链
        Object.setPrototypeOf(this, AppError.prototype);

        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * 参数验证错误 (400)
 */
export class ValidationError extends AppError {
    constructor(message: string) {
        super(message, 400);
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}

/**
 * 资源未找到错误 (404)
 */
export class NotFoundError extends AppError {
    constructor(message: string = "资源未找到") {
        super(message, 404);
        Object.setPrototypeOf(this, NotFoundError.prototype);
    }
}

/**
 * 内部服务器错误 (500)
 */
export class InternalError extends AppError {
    constructor(message: string = "服务器内部错误") {
        super(message, 500, false);
        Object.setPrototypeOf(this, InternalError.prototype);
    }
}
