import { GroupMsgColumn } from "./mappers/GroupMsgColumn";

export type RawGroupMsgFromDB = {
    [key in GroupMsgColumn]: any; // 这里使用 any 类型，根据实际情况调整
}
