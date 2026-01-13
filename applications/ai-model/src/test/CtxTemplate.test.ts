import { describe, it, expect, beforeEach } from "vitest";
import { CtxTemplateNode } from "../context/template/CtxTemplate";

describe("CtxTemplateNode", () => {
    let rootNode: CtxTemplateNode;
    let childNode1: CtxTemplateNode;
    let childNode2: CtxTemplateNode;

    beforeEach(() => {
        rootNode = new CtxTemplateNode();
        childNode1 = new CtxTemplateNode();
        childNode2 = new CtxTemplateNode();
    });

    describe("基本设置与获取", () => {
        it("should set and get title correctly", () => {
            rootNode.setTitle("Root Title");
            expect(rootNode.getTitle()).toBe("Root Title");
        });

        it("should set and get content text correctly", () => {
            rootNode.setContentText("Root content");
            expect(rootNode.getContentText()).toBe("Root content");
        });

        it("should initialize with empty title and content", () => {
            expect(rootNode.getTitle()).toBe("");
            expect(rootNode.getContentText()).toBe("");
        });
    });

    describe("子节点管理", () => {
        it("should set child nodes correctly", () => {
            childNode1.setTitle("Child 1");
            childNode2.setTitle("Child 2");
            rootNode.setChildNodes([childNode1, childNode2]);
            const children = rootNode.getChildNodes();
            expect(children.length).toBe(2);
            expect(children[0].getTitle()).toBe("Child 1");
            expect(children[1].getTitle()).toBe("Child 2");
        });

        it("should insert child node to front correctly", () => {
            rootNode.insertChildNodeToFront(childNode1);
            rootNode.insertChildNodeToFront(childNode2);
            const children = rootNode.getChildNodes();
            expect(children[0].getTitle()).toBe(""); // Default title
            expect(children[1].getTitle()).toBe(""); // Default title
        });

        it("should insert child node to back correctly", () => {
            childNode1.setTitle("First");
            childNode2.setTitle("Second");
            rootNode.insertChildNodeToBack(childNode1);
            rootNode.insertChildNodeToBack(childNode2);
            const children = rootNode.getChildNodes();
            expect(children[0].getTitle()).toBe("First");
            expect(children[1].getTitle()).toBe("Second");
        });

        it("should not mutate original child nodes array when setting", () => {
            const originalArray = [childNode1];
            rootNode.setChildNodes(originalArray);
            originalArray.push(childNode2);
            expect(rootNode.getChildNodes().length).toBe(1);
        });

        it("should return copy of child nodes to prevent external mutation", () => {
            rootNode.setChildNodes([childNode1]);
            const children = rootNode.getChildNodes();
            children.push(childNode2);
            expect(rootNode.getChildNodes().length).toBe(1);
        });

        it("should remove child node by reference successfully", () => {
            rootNode.setChildNodes([childNode1, childNode2]);
            expect(rootNode.removeChildNode(childNode1)).toBe(true);
            expect(rootNode.getChildNodes().length).toBe(1);
            expect(rootNode.getChildNodes()[0]).toBe(childNode2);
        });

        it("should fail to remove non-existent child node by reference", () => {
            rootNode.setChildNodes([childNode1]);
            expect(rootNode.removeChildNode(childNode2)).toBe(false);
            expect(rootNode.getChildNodes().length).toBe(1);
        });

        it("should remove child node by title successfully", () => {
            childNode1.setTitle("Target");
            childNode2.setTitle("Other");
            rootNode.setChildNodes([childNode1, childNode2]);
            expect(rootNode.removeChildNodeByTitle("Target")).toBe(true);
            expect(rootNode.getChildNodes().length).toBe(1);
            expect(rootNode.getChildNodes()[0].getTitle()).toBe("Other");
        });

        it("should remove only first matching child node by title", () => {
            childNode1.setTitle("Duplicate");
            childNode2.setTitle("Duplicate");
            rootNode.setChildNodes([childNode1, childNode2]);
            expect(rootNode.removeChildNodeByTitle("Duplicate")).toBe(true);
            expect(rootNode.getChildNodes().length).toBe(1);
        });

        it("should fail to remove child node with non-matching title", () => {
            childNode1.setTitle("Existing");
            rootNode.setChildNodes([childNode1]);
            expect(rootNode.removeChildNodeByTitle("NonExistent")).toBe(false);
            expect(rootNode.getChildNodes().length).toBe(1);
        });
    });

    describe("深度优先遍历 (DFS)", () => {
        beforeEach(() => {
            rootNode.setTitle("Root");
            childNode1.setTitle("Child1");
            childNode2.setTitle("Child2");
            const grandChild = new CtxTemplateNode();
            grandChild.setTitle("GrandChild");
            childNode1.setChildNodes([grandChild]);
            rootNode.setChildNodes([childNode1, childNode2]);
        });

        it("should traverse all nodes in DFS order", () => {
            const visited: string[] = [];
            rootNode.traverseDFS((node, depth) => {
                visited.push(`${node.getTitle()}@${depth}`);
            });
            expect(visited).toEqual(["Root@1", "Child1@2", "GrandChild@3", "Child2@2"]);
        });

        it("should stop traversal when callback returns false", () => {
            const visited: string[] = [];
            rootNode.traverseDFS((node, depth) => {
                visited.push(`${node.getTitle()}@${depth}`);
                return node.getTitle() !== "Child1"; // Stop after Child1
            });
            expect(visited).toEqual(["Root@1", "Child1@2"]);
        });

        it("should handle empty tree traversal", () => {
            const visited: string[] = [];
            const emptyNode = new CtxTemplateNode();
            emptyNode.traverseDFS((node, depth) => {
                visited.push(`visited@${depth}`);
            });
            expect(visited.length).toBe(1); // traverseDFS visits the node itself
            expect(visited[0]).toBe("visited@1"); // depth starts at 1 for root node
        });

        it("should maintain correct depth levels", () => {
            const depths: number[] = [];
            rootNode.traverseDFS((_, depth) => {
                depths.push(depth);
            });
            expect(depths).toEqual([1, 2, 3, 2]);
        });
    });

    describe("序列化为字符串 (Markdown)", () => {
        it("should serialize single node correctly", () => {
            rootNode.setTitle("Main Title");
            rootNode.setContentText("Main content");
            expect(rootNode.serializeToString()).toBe("# Main Title\nMain content");
        });

        it("should serialize nested structure with proper heading levels", () => {
            rootNode.setTitle("Root");
            childNode1.setTitle("Child");
            childNode1.setContentText("Child content");
            const grandChild = new CtxTemplateNode();
            grandChild.setTitle("GrandChild");
            grandChild.setContentText("Deep content");
            childNode1.setChildNodes([grandChild]);
            rootNode.setChildNodes([childNode1]);

            const result = rootNode.serializeToString();
            expect(result).toBe("# Root\n\n" + "## Child\nChild content\n\n" + "### GrandChild\nDeep content");
        });

        it("should handle nodes without titles", () => {
            rootNode.setContentText("Root content only");
            childNode1.setContentText("Child content only");
            rootNode.setChildNodes([childNode1]);
            expect(rootNode.serializeToString()).toBe("Root content only\n\n" + "Child content only");
        });

        it("should handle nodes without content", () => {
            rootNode.setTitle("Title only");
            childNode1.setTitle("Child title only");
            rootNode.setChildNodes([childNode1]);
            expect(rootNode.serializeToString()).toBe("# Title only\n\n" + "## Child title only");
        });

        it("should skip empty nodes during serialization", () => {
            const emptyNode = new CtxTemplateNode();
            rootNode.setChildNodes([emptyNode, childNode1]);
            childNode1.setTitle("Valid Child");
            // Empty nodes (no title and no content) are completely skipped
            expect(rootNode.serializeToString()).toBe("## Valid Child");
        });

        it("should separate nodes with double newlines", () => {
            rootNode.setTitle("First");
            childNode1.setTitle("Second");
            rootNode.setChildNodes([childNode1]);
            const result = rootNode.serializeToString();
            expect(result.split("\n\n").length).toBe(2);
        });
    });

    describe("序列化为对象", () => {
        it("should serialize single node correctly", () => {
            rootNode.setTitle("Root");
            rootNode.setContentText("Content");
            expect(rootNode.serializeToObject()).toEqual({
                title: "Root",
                contentText: "Content",
                children: []
            });
        });

        it("should serialize nested structure recursively", () => {
            rootNode.setTitle("Root");
            childNode1.setTitle("Child");
            childNode1.setContentText("Text");
            rootNode.setChildNodes([childNode1]);

            const result = rootNode.serializeToObject();
            expect(result).toEqual({
                title: "Root",
                contentText: "",
                children: [
                    {
                        title: "Child",
                        contentText: "Text",
                        children: []
                    }
                ]
            });
        });

        it("should handle empty nodes correctly", () => {
            expect(rootNode.serializeToObject()).toEqual({
                title: "",
                contentText: "",
                children: []
            });
        });

        it("should not mutate original structure during serialization", () => {
            rootNode.setTitle("Original");
            const serialized = rootNode.serializeToObject();
            serialized.title = "Modified";
            expect(rootNode.getTitle()).toBe("Original");
        });
    });

    describe("边界情况与健壮性", () => {
        it("should handle special characters in titles and content", () => {
            rootNode.setTitle("# Special *Title*");
            rootNode.setContentText("Content with\nnew lines");
            expect(rootNode.serializeToString()).toBe("# # Special *Title*\nContent with\nnew lines");
        });

        it("should handle large depth levels correctly", () => {
            let currentNode = rootNode;
            for (let i = 1; i <= 10; i++) {
                const newNode = new CtxTemplateNode();
                newNode.setTitle(`Level ${i}`);
                currentNode.insertChildNodeToBack(newNode);
                currentNode = newNode;
            }
            const result = rootNode.serializeToString();
            expect(result).toContain("########## Level 10");
        });

        it("should not crash with circular references during DFS", () => {
            // Create circular reference (not recommended but should not crash)
            childNode1.setChildNodes([rootNode]);
            rootNode.setChildNodes([childNode1]);

            let visitCount = 0;
            expect(() => {
                rootNode.traverseDFS(() => {
                    visitCount++;
                    return visitCount < 5; // Prevent infinite loop in test
                });
            }).not.toThrow();
        });

        it("should handle null/undefined during child node operations", () => {
            expect(() => rootNode.removeChildNode(null as any)).not.toThrow();
            expect(() => rootNode.removeChildNodeByTitle(null as any)).not.toThrow();
        });

        it("should maintain immutability of internal structures", () => {
            rootNode.setChildNodes([childNode1]);
            const children = rootNode.getChildNodes();
            // getChildNodes returns a shallow copy - array is new but elements are same references
            // Modifying the array itself doesn't affect the internal structure
            children.push(childNode2);
            expect(rootNode.getChildNodes().length).toBe(1); // Array is separate
            // But modifying the element itself will affect it (shallow copy behavior)
            // This is by design for performance; full deep copy would be expensive
        });
    });
});
