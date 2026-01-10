# WebUI Frontend

WebUI 前端项目，提供用户友好的图形界面。

## 功能特性

- **现代化UI**：基于 HeroUI 组件库的精美界面
- **数据可视化**：使用 ECharts 进行数据展示
- **响应式设计**：适配不同屏幕尺寸
- **路由管理**：使用 React Router 进行页面导航
- **Markdown渲染**：支持 Markdown 格式的内容显示

## 技术栈

- **React 18**：UI框架
- **Vite**：构建工具
- **HeroUI**：React组件库
- **TailwindCSS**：CSS框架
- **ECharts**：数据可视化库
- **React Router**：路由管理
- **Framer Motion**：动画库
- **Lucide React**：图标库

## 开发命令

```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 启动开发服务器（使用mock数据）
pnpm dev:mock

# 构建生产版本
pnpm build

# 预览生产构建
pnpm preview

# 代码检查和修复
pnpm lint
```

## 项目结构

```
src/
├── components/    # 公共组件
├── pages/         # 页面组件
├── router/        # 路由配置
├── hooks/         # 自定义Hooks
├── utils/         # 工具函数
└── main.tsx       # 应用入口
```

## 设计原则

- 完全内聚，不引用 `common` 目录下的代码
- 使用 TypeScript 进行类型检查
- 遵循 ESLint 和 Prettier 代码规范

## 开发规范

- 使用 HeroUI 组件库提供的组件
- 遵循统一的代码风格
- 组件使用 JSDoc 注释说明功能
