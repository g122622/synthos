import { DownloadedGroupFile, GroupFileInfo } from "@root/common/contracts/data-provider";
import { Disposable } from "@root/common/util/lifecycle/Disposable";

export interface IGroupFileProvider extends Disposable {
    init(): Promise<void>;
    listGroupFiles(groupId: string): Promise<GroupFileInfo[]>;
    getGroupFileDownloadUrl(groupId: string, fileId: string, busid?: number): Promise<string>;
    downloadGroupFile(
        groupId: string,
        fileId: string,
        fileName?: string,
        busid?: number
    ): Promise<DownloadedGroupFile>;
}
