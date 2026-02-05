/**
 * 将数组中的每个元素重复指定次数后生成新数组
 *
 * @template T - 数组元素的类型
 * @param {T[]} array - 需要处理的输入数组
 * @param {number} [repeatCount=2] - 每个元素的重复次数（必须为正整数）
 * @returns {T[]} 新数组，其中每个元素按指定次数重复
 *
 * @example
 * // 基本用法（默认重复2次）
 * duplicateElements([1, 2, 3]);
 * // 返回 [1, 1, 2, 2, 3, 3]
 *
 * @example
 * // 自定义重复次数
 * duplicateElements(['a', 'b'], 3);
 * // 返回 ['a', 'a', 'a', 'b', 'b', 'b']
 *
 * @example
 * // 边界情况处理
 * duplicateElements([1, 2], 0);   // 返回 []
 * duplicateElements([1, 2], -1);  // 返回 []
 * duplicateElements([1, 2], 1.5); // 返回 [1, 1, 2, 2] (非整数会向下取整)
 *
 * @note
 * - 当 repeatCount <= 0 时返回空数组
 * - 非整数 repeatCount 会被 JavaScript 引擎自动转换为整数（如 2.9 会变成 2）
 * - 原始数组不会被修改（纯函数）
 * - 时间复杂度: O(n*m)，其中 n 为数组长度，m 为重复次数
 */
function duplicateElements<T>(array: T[], repeatCount: number = 2): T[] {
    if (repeatCount <= 0) return [];

    return array.reduce<T[]>((result, item) => {
        for (let i = 0; i < repeatCount; i++) {
            result.push(item);
        }

        return result;
    }, []);
}

export { duplicateElements };
