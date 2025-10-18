// KVStore.ts
import { Level } from "level";

/**
 * 简洁的键值存储类，专为 Node.js 设计，自动使用 JSON 编码
 * 键为 string，值为任意可 JSON 序列化的类型
 */
export class KVStore<T = any> {
    private db: Level<string, T>;

    /**
     * 创建或打开一个键值数据库
     * @param location 数据库存储目录路径（如 './data/mydb'）
     */
    constructor(location: string) {
        // 内部强制使用 JSON 编码，对外隐藏实现细节
        this.db = new Level<string, T>(location, { valueEncoding: "json" });
    }

    /**
     * 写入键值对
     */
    async put(key: string, value: T): Promise<void> {
        await this.db.put(key, value);
    }

    /**
     * 读取值
     */
    async get(key: string): Promise<T | undefined> {
        try {
            return await this.db.get(key);
        } catch (error) {
            return undefined;
        }
    }

    /**
     * 删除键
     */
    async del(key: string): Promise<void> {
        await this.db.del(key);
    }

    /**
     * 批量操作（原子性）
     * @param ops 操作数组，每个操作包含 type、key，put 操作还需 value
     */
    async batch(ops: Array<{ type: "put"; key: string; value: T } | { type: "del"; key: string }>): Promise<void> {
        await this.db.batch(ops);
    }

    /**
     * 关闭数据库（建议在应用退出前调用）
     */
    async close(): Promise<void> {
        await this.db.close();
    }
}

// example.ts
// import { KVStore } from "./KVStore";

// interface User {
//     id: string;
//     name: string;
//     email: string;
// }

// async function main() {
//     const store = new KVStore<User>("./data/users");

//     // 写入
//     await store.put("user:1", { id: "1", name: "Alice", email: "alice@example.com" });
//     await store.put("user:2", { id: "2", name: "Bob", email: "bob@example.com" });

//     // 读取
//     const user1 = await store.get("user:1");
//     console.log(user1.name); // "Alice"

//     // 批量删除
//     await store.batch([
//         { type: "del", key: "user:2" },
//         { type: "put", key: "user:3", value: { id: "3", name: "Charlie", email: "charlie@example.com" } }
//     ]);

//     // 关闭
//     await store.close();
// }

// main().catch(console.error);
