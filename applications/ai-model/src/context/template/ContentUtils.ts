export class ContentUtils {
    public static unorderedList(list: string[]) {
        return list.map(item => `- ${item}`).join("\n");
    }

    public static orderedList(list: string[]) {
        return list.map((item, index) => `${index + 1}. ${item}`).join("\n");
    }
}

// 使用示例：
// const items = ["Apple", "Banana", "Cherry"];

// console.log(ContentUtils.unorderedList(items));
// // 输出：
// // - Apple
// // - Banana
// // - Cherry

// console.log(ContentUtils.orderedList(items));
// // 输出：
// // 1. Apple
// // 2. Banana
// // 3. Cherry
