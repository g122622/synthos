import { describe, it, expect } from "vitest";
import { escapeHtml } from "../util/secure/escapeHtml";

describe("escapeHtml", () => {
    it("应该转义基本的HTML特殊字符", () => {
        const input = '<script>alert("XSS")</script>';
        const expected = "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;";
        expect(escapeHtml(input)).toBe(expected);
    });

    it("应该转义&符号", () => {
        const input = "Tom & Jerry";
        const expected = "Tom &amp; Jerry";
        expect(escapeHtml(input)).toBe(expected);
    });

    it("应该转义单引号", () => {
        const input = "It's a test";
        const expected = "It&#039;s a test";
        expect(escapeHtml(input)).toBe(expected);
    });

    it("应该转义所有特殊字符的组合", () => {
        const input = `<div class="test" data-value='test&co'>Hello</div>`;
        const expected = `&lt;div class=&quot;test&quot; data-value=&#039;test&amp;co&#039;&gt;Hello&lt;/div&gt;`;
        expect(escapeHtml(input)).toBe(expected);
    });

    it("应该保持普通文本不变", () => {
        const input = "Hello World 123";
        expect(escapeHtml(input)).toBe(input);
    });

    it("应该处理空字符串", () => {
        expect(escapeHtml("")).toBe("");
    });

    it("当设置preserveNewlines时应该将换行符转换为<br>", () => {
        const input = "Line 1\nLine 2\nLine 3";
        const expected = "Line 1<br>Line 2<br>Line 3";
        expect(escapeHtml(input, { preserveNewlines: true })).toBe(expected);
    });

    it("应该同时转义特殊字符和换行符", () => {
        const input = '<script>\nalert("test");\n</script>';
        const expected = "&lt;script&gt;<br>alert(&quot;test&quot;);<br>&lt;/script&gt;";
        expect(escapeHtml(input, { preserveNewlines: true })).toBe(expected);
    });

    it("默认不转换换行符", () => {
        const input = "Line 1\nLine 2";
        const expected = "Line 1\nLine 2";
        expect(escapeHtml(input)).toBe(expected);
    });
});
