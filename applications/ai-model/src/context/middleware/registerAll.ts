import { MiddlewareContainer, CTX_MIDDLEWARE_TOKENS } from "./container/container";
import { addBackgroundKnowledgeMiddleware } from "./middlewares/addBackgroundKnowledge";
import { injectTimeMiddleware } from "./middlewares/injectTime";

// 注册中间件
const container = MiddlewareContainer.getInstance();

container.register(CTX_MIDDLEWARE_TOKENS.INJECT_TIME, injectTimeMiddleware);
container.register(CTX_MIDDLEWARE_TOKENS.ADD_BACKGROUND_KNOWLEDGE, addBackgroundKnowledgeMiddleware);
