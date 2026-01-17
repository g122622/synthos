/**
 * CtxTemplateNode 类
 * 表示上下文模板中的一个节点，支持标题、内容和子节点
 * 用于构建上下。最后会被序列化为字符串，喂给大模型
 */
export class CtxTemplateNode {
    // 子节点列表
    private _childNodes: CtxTemplateNode[] = [];
    // 节点标题
    private _title: string = "";
    // 节点内容文本
    private _contentText: string = "";

    /**
     * 设置节点标题
     * @param title 标题字符串
     */
    public setTitle(title: string): CtxTemplateNode {
        this._title = title;
        return this;
    }

    /**
     * 设置节点内容文本。支持链式调用
     * @param contentText 内容文本字符串
     * @note 不用加末尾的换行符！
     */
    public setContentText(contentText: string): CtxTemplateNode {
        this._contentText = contentText;
        return this;
    }

    /**
     * 设置子节点列表（会替换原有子节点）。支持链式调用
     * @param childNodes 新的子节点数组
     */
    public setChildNodes(childNodes: CtxTemplateNode[]): CtxTemplateNode {
        this._childNodes = [...childNodes];
        return this;
    }

    /**
     * 在子节点列表的最前面插入一个子节点。支持链式调用
     * @param node 要插入的子节点
     */
    public insertChildNodeToFront(node: CtxTemplateNode): CtxTemplateNode {
        this._childNodes.unshift(node);
        return this;
    }
    /**
     * 在子节点列表的末尾追加一个子节点。支持链式调用
     * @param node 要插入的子节点
     */
    public insertChildNodeToBack(node: CtxTemplateNode): CtxTemplateNode {
        this._childNodes.push(node);
        return this;
    }

    /**
     * 根据节点引用删除一个子节点
     * @param node 要删除的子节点（必须是当前子节点列表中的同一个引用）
     * @returns 是否删除成功
     */
    public removeChildNode(node: CtxTemplateNode): boolean {
        const index = this._childNodes.indexOf(node);
        if (index !== -1) {
            this._childNodes.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 根据标题删除第一个匹配的子节点（模糊匹配：完全相等）
     * @param title 要删除的子节点的标题
     * @returns 是否删除成功
     */
    public removeChildNodeByTitle(title: string): boolean {
        const index = this._childNodes.findIndex(child => child.getTitle() === title);
        if (index !== -1) {
            this._childNodes.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * 深度优先遍历整棵树（从当前节点开始）
     * 对每个访问到的节点执行回调函数，并传入当前深度（根节点深度为 1）
     * @param callback 回调函数，接收 (node, depth) 作为参数；若返回 false 则停止遍历
     */
    public traverseDFS(callback: (node: CtxTemplateNode, depth: number) => boolean | void): void {
        const dfs = (node: CtxTemplateNode, depth: number) => {
            const shouldContinue = callback(node, depth);
            if (shouldContinue === false) {
                return false;
            }

            for (const child of node._childNodes) {
                const continueTraversal = dfs(child, depth + 1);
                if (continueTraversal === false) {
                    return false;
                }
            }
            return true;
        };

        dfs(this, 1);
    }

    /**
     * 将当前节点及其子树序列化为字符串，标题根据递归深度自动设置 Markdown 标题级别
     * （深度 1 → "# 标题"，深度 2 → "## 标题"，...）
     * 内容紧随标题（如有），节点间用两个换行分隔
     * @returns 序列化后的字符串
     */
    public serializeToString(): string {
        const parts: string[] = [];

        this.traverseDFS((node, depth) => {
            let segment = "";
            // 添加标题（如果存在）
            if (node._title) {
                segment += `${"#".repeat(depth)} ${node._title}`;
            }
            // 添加内容（如果存在）
            if (node._contentText) {
                if (segment) {
                    segment += "\n";
                }
                segment += node._contentText;
            }
            // 只有非空段才加入
            if (segment) {
                parts.push(segment);
            }
        });

        return parts.join("\n\n");
    }

    /**
     * 重写 toString 方法，调用 serializeToString
     * @returns 序列化后的字符串
     */
    public toString(): string {
        return this.serializeToString();
    }

    /**
     * 将当前节点及其子树序列化为普通 JavaScript 对象（可被 JSON.stringify 序列化）
     * @returns 包含 title、contentText 和 children 的普通对象
     */
    public serializeToObject(): {
        title: string;
        contentText: string;
        children: ReturnType<CtxTemplateNode["serializeToObject"]>[]; // 递归类型
    } {
        return {
            title: this._title,
            contentText: this._contentText,
            children: this._childNodes.map(child => child.serializeToObject())
        };
    }

    // ========== Getter 方法 ==========

    /**
     * 获取节点标题
     */
    public getTitle(): string {
        return this._title;
    }

    /**
     * 获取节点内容文本
     */
    public getContentText(): string {
        return this._contentText;
    }

    /**
     * 获取子节点列表（返回副本，防止外部直接修改内部结构）
     */
    public getChildNodes(): CtxTemplateNode[] {
        return [...this._childNodes];
    }
}
