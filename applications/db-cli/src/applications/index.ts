// 导入 applications 目录下的所有 application

import { IApplicationClass } from "@/contracts/IApplication";
import { ExecSQL } from "./ExecSQL";
import { PrintCurrentConfig } from "./PrintCurrentConfig";
import { MigrateDB } from "./MigrateDB";
import { SeekQQNumber } from "./SeekQQNumber";
import { BuildImMessageFtsIndex } from "./BuildImMessageFtsIndex";

// 全部导出
export const applications: IApplicationClass[] = [
    ExecSQL,
    PrintCurrentConfig,
    MigrateDB,
    SeekQQNumber,
    BuildImMessageFtsIndex
];
