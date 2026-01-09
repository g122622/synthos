## 【要求&约束】

**写代码前：**
1. 请你先充分阅读和探索这个项目中的readme、相关的文件（你还可以在网上查找上面涉及到的项目的文档，遇到问题了也可以随时联网查找），然后指出你还有哪些疑惑、我没描述清楚的地方，停下来等我回答。
2. 务必尽可能复用项目中已有的基建，你可以在写代码前把common目录全看一遍，并确保生成的代码和现有文件的编写风格一致
3. 项目使用pnpm + monorepo管理依赖，严禁使用npm！若想新增依赖，你需要先修改子项目的package.json，然后再退回到整个monorepo大仓的根目录执行pnpm install。不要在子项目目录中执行pnpm install

**写代码时：**
1. 本项目的monorepo结构要求子项目之间不能有任何的相互引用（子项目只能引用 `项目根目录/common` 下的代码；特别的是，webui-frontend子项目必须完全内聚，不允许引用`项目根目录/common`）；如果需要子项目之间相互调用，可以走tRPC
2. 项目使用tsyringe进行依赖注入，若要使用common/services下的服务，必须通过DI框架进行获取。可参考`applications\ai-model\src\tasks\AISummarize.ts`的写法
3. 涉及到迁移和重构类任务时，务必尽可能保留原代码中的注释（如果注释内容随着迁移已经过时或错误，则进行改写）
4. 若要新增后端接口，务必使用 applications/webui-backend/src/schemas 来进行参数校验
5. ConfigManagerService在冷启动时会对配置文件根据schema进行强校验，因此配置文件在运行时一定是完整的、正确的，不用担心某些字段不存在，因此不要写出类似下面代码：
```ts
// NO!
const interestScoreThreshold = config.report?.generation?.interestScoreThreshold ?? 0;
// 直接写成下面的即可：
const interestScoreThreshold = config.report.generation.interestScoreThreshold; // 不允许使用可选链和默认值
```
6. 对于涉及`index`的引入，import的时候不允许省略`index` 例如：`import { xxx } from "../contracts/report/index";` 而不是 `import { xxx } from "../contracts/report";`，此外也不能写成 `import { xxx } from "../contracts/report/index.ts";`
7. 项目中所有number类型的时间表示统一使用标准UNIX毫秒级时间戳
8. 错误处理规范：所有空指针操作（比如根据不存在的id查询对应的数据、删除不存在的id等）一律立即抛错，不要静默处理；如果该操作返回结果是数组，那么此时不必抛错，可以返回空数组

**写完代码后：**
1. 请在代码修改完成后，检查对应的这些文件（如果有的话）是否要增加/删除相应内容：README；package.json；文档；单元测试；集成测试；mock
2. 代码编写完成后先构建common，然后再在子项目根目录下执行 `npx tsc --noEmit 2>&1` 检查是否有语法错误；如果更改的文件涉及对应的测试文件，请运行测试文件；若更改涉及前端页面，则检查完语法错误后在前端子项目根目录下执行 `npx eslint --fix .` 来修复eslint格式问题
3. 请在结束后清理掉你在调试过程中加的注释和日志输出（如果有的话）
4. 最后的最后，如果上面的事情都做完了，则在根目录运行 `npx prettier --write .` 来格式化全部代码

## 【代码样式规范】
1. 函数参数列表尽量不加默认参数
2. 注释、日志输出都使用中文
3. 不允许省略类成员的访问修饰符（如private、public）；private方法命名加上下划线前缀，如`_doDeleteEmbedding`
4. 由于正则表达式易出错且不易code-review，请避免使用正则
5. 为类和类的方法编写jsdoc格式的注释
6. if语句或循环语句后的代码块即使只有一行，也不许省略大括号
