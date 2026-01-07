本次改造中的几个难点：

## 1. CommonDBService 的特殊设计挑战

问题：CommonDBService 原本在构造函数中接收 initialSQL 参数，而每个 DbAccessService（如 AgcDbAccessService、ImDbAccessService 等）都需要传入不同的建表 SQL。这与标准的 DI 单例模式冲突。

解决方案：将 initialSQL 从构造函数参数改为 init(initialSQL?) 方法参数，使 CommonDBService 可以被 DI 容器管理（每次 resolve 返回新实例），同时保持灵活性。

*// 改造前*

constructor(initialSQL?: string) { ... }

async init(): Promise<void> { ... }

*// 改造后*

public constructor(@inject(COMMON_TOKENS.ConfigManagerService) private configManagerService: IConfigManagerService) { ... }

public async init(initialSQL?: string): Promise<void> { ... }

## 2. TypeScript 装饰器配置缺失

问题：common/tsconfig.json 原本没有启用 experimentalDecorators 和 emitDecoratorMetadata，导致添加 @injectable() 和 @inject() 装饰器后编译报错：error TS1206: Decorators are not valid here。

解决方案：更新 common/tsconfig.json，添加装饰器相关配置：

{

  "experimentalDecorators": true,

  "emitDecoratorMetadata": true

}

## 3. 单例与非单例的权衡

问题：不同类型的服务需要不同的生命周期管理：

- ConfigManagerService、EmailService、TextGenerator 应该是单例（整个应用共享一个实例）

- CommonDBService、QQProvider、AccumulativeSplitter 应该是非单例（每次需要新实例，因为有独立的生命周期 init/dispose）

解决方案：使用不同的注册方式：

*// 单例*

container.registerSingleton(TOKEN, Class);

*// 或*

container.registerInstance(TOKEN, instance);

*// 非单例（每次 resolve 返回新实例）*

container.register(TOKEN, { useClass: Class });

## 4. 测试文件的适配

问题：单元测试和集成测试中直接 new QQProvider() 创建实例，改造后构造函数需要 configManagerService 参数，导致测试编译失败。

解决方案：

- 在测试开始前注册 DI 容器（registerConfigManagerService(), registerQQProvider()）

- 将 new QQProvider() 改为 getQQProvider()

## 5. 循环依赖的潜在风险

问题：PooledTextGenerator 和 GenerateReport 内部直接 new TextGenerator()，但 TextGenerator 改造后需要从 DI 获取。如果在 DI 容器完全初始化之前调用 getTextGenerator()，会导致运行时错误。

解决方案：确保 DI 注册顺序正确，registerTextGenerator() 必须在任何使用 getTextGenerator() 的代码之前调用。在 ai-model/src/index.ts 中明确了初始化顺序。

## 6. 默认单例导出的废弃

问题：EmailService 原本导出了一个默认单例实例 export default instance，改造后由于构造函数需要参数，无法直接 new EmailService() 创建默认实例。

解决方案：删除默认单例导出，统一通过 DI 容器管理：

*// 删除这些*

const instance = new EmailService();

export default instance;

*// 改为只导出类*

export { EmailService };

------

总体来说，最核心的挑战是平衡依赖注入的统一性与各类特殊需求（如 CommonDBService 的动态 SQL、非单例的生命周期管理等）。通过合理调整 API 设计（如将参数从构造函数移到 init 方法）和使用正确的 DI 注册方式，成功实现了改造目标。