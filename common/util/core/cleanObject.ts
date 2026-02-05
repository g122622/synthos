// 去除对象中值为空字符串、undefined、null的属性
export function cleanObject(obj: any, shouldRemoveZeroValue = false) {
    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const value = obj[key];

            if (value === "" || value === undefined || value === null || (shouldRemoveZeroValue && value === 0)) {
                delete obj[key];
            } else if (typeof value === "object" && value !== null) {
                cleanObject(value, shouldRemoveZeroValue); // 递归处理嵌套对象
            }
        }
    }

    return obj;
}
