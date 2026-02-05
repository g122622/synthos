import type { ToolContext, ToolDefinition } from "../agent/contracts/index";

import { describe, it, expect, vi } from "vitest";

import { AgentToolCatalog } from "../agent-langgraph/AgentToolCatalog";

vi.mock("@root/common/util/Logger", () => {
    return {
        default: {
            withTag: () => ({
                debug: vi.fn(),
                info: vi.fn(),
                warning: vi.fn(),
                error: vi.fn(),
                success: vi.fn()
            })
        }
    };
});

const makeToolDef = (name: string): ToolDefinition => {
    return {
        type: "function",
        function: {
            name,
            description: `${name} 工具`,
            parameters: {
                type: "object",
                properties: {
                    q: { type: "string" }
                },
                required: ["q"]
            }
        }
    };
};

describe("AgentToolCatalog", () => {
    it("未传 enabledTools 时应返回空工具列表", () => {
        const catalog = new AgentToolCatalog(
            {
                getDefinition: () => makeToolDef("rag_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("sql_query"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("web_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any
        );

        expect(catalog.getEnabledToolDefinitions(undefined)).toEqual([]);
        expect(catalog.getEnabledToolDefinitions([])).toEqual([]);
    });

    it("应只返回启用的工具定义", () => {
        const catalog = new AgentToolCatalog(
            {
                getDefinition: () => makeToolDef("rag_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("sql_query"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("web_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any
        );

        const defs = catalog.getEnabledToolDefinitions(["sql_query"]);

        expect(defs).toHaveLength(1);
        expect(defs[0].function.name).toBe("sql_query");
    });

    it("未启用工具时应拒绝执行", async () => {
        const catalog = new AgentToolCatalog(
            {
                getDefinition: () => makeToolDef("rag_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("sql_query"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("web_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any
        );

        const ctx: ToolContext = { sessionId: "s1" };

        await expect(catalog.executeTool("rag_search", { q: "hi" }, ctx, ["sql_query"])).rejects.toThrow(
            "工具未启用"
        );
    });

    it("启用工具时应允许执行并返回结果", async () => {
        const catalog = new AgentToolCatalog(
            {
                getDefinition: () => makeToolDef("rag_search"),
                getExecutor: () => async (params: any) => ({ ok: true, params })
            } as any,
            {
                getDefinition: () => makeToolDef("sql_query"),
                getExecutor: () => async () => ({ ok: true })
            } as any,
            {
                getDefinition: () => makeToolDef("web_search"),
                getExecutor: () => async () => ({ ok: true })
            } as any
        );

        const ctx: ToolContext = { sessionId: "s1" };
        const result = await catalog.executeTool("rag_search", { q: "hi" }, ctx, ["rag_search"]);

        expect(result).toEqual({ ok: true, params: { q: "hi" } });
    });
});
