export class EmbeddingPromptStore {
    public static getEmbeddingPromptForRAG(userQuestion: string) {
        return `Instruct: Given a web search query about computer science, AI research, technology or university, retrieve relevant and longer passages that answer the query.\nQuery: ${userQuestion}`;
    }
}
