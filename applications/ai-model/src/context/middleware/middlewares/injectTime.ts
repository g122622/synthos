import { CtxTemplateNode } from "../../../context/template/CtxTemplate";
import { CtxMiddleware } from "../container/container";
import { getCurrentFormattedTime } from "@root/common/util/TimeUtils";

// 注入当前日期时间
export const injectTimeMiddleware: CtxMiddleware = rootNode => {
    rootNode.insertChildNodeToFront(
        new CtxTemplateNode().setTitle("当前日期时间").setContentText(getCurrentFormattedTime())
    );
    return rootNode;
};
