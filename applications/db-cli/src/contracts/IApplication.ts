export interface IApplication {
    init(): Promise<void>;
    run(): Promise<void>;
    dispose(): Promise<void>;
}

/**
 * 应用类的构造函数接口，用于定义静态属性
 */
export interface IApplicationClass {
    /** 应用名称 */
    appName: string;
    /** 应用描述 */
    description: string;
    new (): IApplication;
}
