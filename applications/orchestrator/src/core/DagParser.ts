import {
    WorkflowDefinition,
    WorkflowNode,
    WorkflowNodeType,
    ExecutionPlan
} from "@root/common/contracts/workflow/index";

/**
 * DAG 解析器
 * 负责解析工作流定义，构建执行计划，并进行拓扑校验
 */
export class DagParser {
    private _workflow: WorkflowDefinition;
    private _adjacencyList: Map<string, string[]>; // nodeId -> [targetNodeIds]
    private _inDegreeMap: Map<string, number>; // nodeId -> inDegree
    private _nodeMap: Map<string, WorkflowNode>; // nodeId -> WorkflowNode

    /**
     * 构造函数
     * @param workflow 工作流定义
     */
    public constructor(workflow: WorkflowDefinition) {
        this._workflow = workflow;
        this._adjacencyList = new Map();
        this._inDegreeMap = new Map();
        this._nodeMap = new Map();
    }

    /**
     * 解析并生成执行计划
     * @returns 执行计划
     * @throws 如果 DAG 校验失败则抛出错误
     */
    public parse(): ExecutionPlan {
        this._buildGraph();
        this._validateStartEndNodes();
        this._validateConnectivity();
        const layers = this._topologicalSort();
        const parallelBranches = this._identifyParallelBranches();
        const convergencePoints = this._identifyConvergencePoints();

        return {
            layers,
            parallelBranches,
            convergencePoints
        };
    }

    /**
     * 构建邻接表和入度映射
     */
    private _buildGraph(): void {
        // 初始化节点映射和入度
        for (const node of this._workflow.nodes) {
            this._nodeMap.set(node.id, node);
            this._adjacencyList.set(node.id, []);
            this._inDegreeMap.set(node.id, 0);
        }

        // 构建邻接表和入度
        for (const edge of this._workflow.edges) {
            const sourceId = edge.source;
            const targetId = edge.target;

            // 校验边的源节点和目标节点是否存在
            if (!this._nodeMap.has(sourceId)) {
                throw new Error(`边 ${edge.id} 的源节点 ${sourceId} 不存在`);
            }
            if (!this._nodeMap.has(targetId)) {
                throw new Error(`边 ${edge.id} 的目标节点 ${targetId} 不存在`);
            }

            const neighbors = this._adjacencyList.get(sourceId);

            if (neighbors) {
                neighbors.push(targetId);
            }

            const inDegree = this._inDegreeMap.get(targetId);

            if (inDegree !== undefined) {
                this._inDegreeMap.set(targetId, inDegree + 1);
            }
        }
    }

    /**
     * 校验 start 和 end 节点数量
     * 必须恰好有一个 start 节点和一个 end 节点
     */
    private _validateStartEndNodes(): void {
        const startNodes = this._workflow.nodes.filter(
            (node: WorkflowNode) => node.type === WorkflowNodeType.Start
        );
        const endNodes = this._workflow.nodes.filter((node: WorkflowNode) => node.type === WorkflowNodeType.End);

        if (startNodes.length === 0) {
            throw new Error("工作流中必须有一个 start 节点");
        }
        if (startNodes.length > 1) {
            throw new Error(`工作流中只能有一个 start 节点，当前有 ${startNodes.length} 个`);
        }
        if (endNodes.length === 0) {
            throw new Error("工作流中必须有一个 end 节点");
        }
        if (endNodes.length > 1) {
            throw new Error(`工作流中只能有一个 end 节点，当前有 ${endNodes.length} 个`);
        }
    }

    /**
     * 校验连通性：所有节点从 start 节点可达
     */
    private _validateConnectivity(): void {
        const startNode = this._workflow.nodes.find((node: WorkflowNode) => node.type === WorkflowNodeType.Start);

        if (!startNode) {
            throw new Error("未找到 start 节点");
        }

        const reachableNodes = new Set<string>();
        const queue: string[] = [startNode.id];

        reachableNodes.add(startNode.id);

        while (queue.length > 0) {
            const currentId = queue.shift();

            if (!currentId) {
                continue;
            }

            const neighbors = this._adjacencyList.get(currentId);

            if (neighbors) {
                for (const neighborId of neighbors) {
                    if (!reachableNodes.has(neighborId)) {
                        reachableNodes.add(neighborId);
                        queue.push(neighborId);
                    }
                }
            }
        }

        // 检查是否有不可达的节点
        const unreachableNodes = this._workflow.nodes.filter((node: WorkflowNode) => !reachableNodes.has(node.id));

        if (unreachableNodes.length > 0) {
            const unreachableIds = unreachableNodes.map((n: WorkflowNode) => n.id).join(", ");

            throw new Error(`以下节点从 start 节点不可达: ${unreachableIds}`);
        }
    }

    /**
     * 拓扑排序（使用 Kahn 算法）
     * @returns 分层的节点 ID 列表
     * @throws 如果存在环则抛出错误
     */
    private _topologicalSort(): string[][] {
        const layers: string[][] = [];
        const inDegree = new Map(this._inDegreeMap); // 复制入度映射
        const queue: string[] = [];

        // 找到所有入度为 0 的节点（起始节点）
        for (const [nodeId, degree] of inDegree.entries()) {
            if (degree === 0) {
                queue.push(nodeId);
            }
        }

        let processedCount = 0;

        while (queue.length > 0) {
            const currentLayerSize = queue.length;
            const currentLayer: string[] = [];

            // 处理当前层的所有节点
            for (let i = 0; i < currentLayerSize; i++) {
                const nodeId = queue.shift();

                if (!nodeId) {
                    continue;
                }

                currentLayer.push(nodeId);
                processedCount++;

                // 更新邻居节点的入度
                const neighbors = this._adjacencyList.get(nodeId);

                if (neighbors) {
                    for (const neighborId of neighbors) {
                        const currentInDegree = inDegree.get(neighborId);

                        if (currentInDegree !== undefined) {
                            const newInDegree = currentInDegree - 1;

                            inDegree.set(neighborId, newInDegree);

                            // 如果邻居节点的入度变为 0，加入队列
                            if (newInDegree === 0) {
                                queue.push(neighborId);
                            }
                        }
                    }
                }
            }

            if (currentLayer.length > 0) {
                layers.push(currentLayer);
            }
        }

        // 如果处理的节点数小于总节点数，说明存在环
        if (processedCount < this._workflow.nodes.length) {
            const remainingNodes = this._workflow.nodes
                .filter((node: WorkflowNode) => {
                    const degree = inDegree.get(node.id);

                    return degree !== undefined && degree > 0;
                })
                .map((n: WorkflowNode) => n.id)
                .join(", ");

            throw new Error(`工作流中存在环路，涉及节点: ${remainingNodes}`);
        }

        return layers;
    }

    /**
     * 识别并行分支
     * 如果一个节点有多条出边，且目标节点之间没有直接或间接的依赖关系，则认为是并行分支
     * @returns 并行分支映射：起点节点 ID -> 并行分支的节点 ID 列表
     */
    private _identifyParallelBranches(): Map<string, string[]> {
        const parallelBranches = new Map<string, string[]>();

        for (const [nodeId, neighbors] of this._adjacencyList.entries()) {
            if (neighbors.length > 1) {
                // 简单判断：如果一个节点有多条出边，就认为是并行分支
                // 更严格的判断需要检查目标节点之间是否有依赖关系
                parallelBranches.set(nodeId, [...neighbors]);
            }
        }

        return parallelBranches;
    }

    /**
     * 识别汇聚点
     * 如果一个节点有多条入边，则认为是汇聚点
     * @returns 汇聚点节点 ID 集合
     */
    private _identifyConvergencePoints(): Set<string> {
        const convergencePoints = new Set<string>();

        for (const [nodeId, inDegree] of this._inDegreeMap.entries()) {
            if (inDegree > 1) {
                convergencePoints.add(nodeId);
            }
        }

        return convergencePoints;
    }

    /**
     * 获取节点的所有前驱节点
     * @param nodeId 节点 ID
     * @returns 前驱节点 ID 列表
     */
    public getPredecessors(nodeId: string): string[] {
        const predecessors: string[] = [];

        for (const edge of this._workflow.edges) {
            if (edge.target === nodeId) {
                predecessors.push(edge.source);
            }
        }

        return predecessors;
    }

    /**
     * 获取节点的所有后继节点
     * @param nodeId 节点 ID
     * @returns 后继节点 ID 列表
     */
    public getSuccessors(nodeId: string): string[] {
        return this._adjacencyList.get(nodeId) || [];
    }

    /**
     * 获取节点对象
     * @param nodeId 节点 ID
     * @returns 节点对象，如果不存在则返回 undefined
     */
    public getNode(nodeId: string): WorkflowNode | undefined {
        return this._nodeMap.get(nodeId);
    }
}
