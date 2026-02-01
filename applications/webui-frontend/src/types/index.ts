import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
    size?: number;
};

// 导出所有业务类型
export * from "./agent";
export * from "./api";
export * from "./app";
export * from "./chat";
export * from "./config";
export * from "./group";
export * from "./log";
export * from "./notification";
export * from "./rag";
export * from "./report";
export * from "./system";
export * from "./topic";
export * from "./topicReference";
