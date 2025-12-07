import { isEqual } from "lodash-es";

export function deepUnique<T>(arr: T[]): T[] {
    return arr.filter((item, index) => !arr.slice(0, index).some(prev => isEqual(prev, item)));
}
