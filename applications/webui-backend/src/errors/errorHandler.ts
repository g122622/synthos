/**
 * 统一错误处理中间件
 */
import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import Logger from "@root/common/util/Logger";

import { AppError } from "./AppError";

const LOGGER = Logger.withTag("WebUI-Backend");

/**
 * 将 Zod 错误转换为友好的错误消息
 */
function formatZodError(error: ZodError): string {
    const issues = error.issues;

    if (issues.length === 0) {
        return "参数验证失败";
    }

    // 只返回第一个错误的描述
    const firstIssue = issues[0];
    const path = firstIssue.path.join(".");
    const message = firstIssue.message;

    if (path) {
        return `参数 ${path}: ${message}`;
    }

    return message;
}

/**
 * 全局错误处理中间件
 */
export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
    // Zod 验证错误
    if (err instanceof ZodError) {
        const message = formatZodError(err);

        res.status(400).json({
            success: false,
            message
        });

        return;
    }

    // 自定义 AppError
    if (err instanceof AppError) {
        if (!err.isOperational) {
            LOGGER.error(`非预期错误: ${err.message}`);
        }
        res.status(err.statusCode).json({
            success: false,
            message: err.message
        });

        return;
    }

    // 未知错误
    LOGGER.error(`未处理的错误: ${err.message}`);
    res.status(500).json({
        success: false,
        message: "服务器内部错误"
    });
}

/**
 * 包装异步路由处理器，自动捕获错误
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}
