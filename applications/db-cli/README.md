# DB CLI

数据库命令行工具，提供交互式的数据库操作界面。

## 功能特性

- **SQL执行**：执行自定义SQL查询
- **数据库迁移**：执行数据库迁移脚本
- **配置查看**：查看当前数据库配置信息
- **QQ号码查询**：在数据库中查询特定的QQ号码

## 技术栈

- **inquirer**：交互式命令行界面

## 项目结构

```
src/
├── applications/      # 应用程序实现
│   ├── ExecSQL.ts       # SQL执行
│   ├── MigrateDB.ts     # 数据库迁移
│   ├── PrintCurrentConfig.ts  # 配置查看
│   └── SeekQQNumber.ts  # QQ号码查询
├── contracts/         # 应用程序接口定义
└── index.ts           # 主入口
```

## 使用方式

在项目根目录执行：

```bash
# 构建
pnpm run build

# 运行CLI工具
node dist/index.js
```

## 可用命令

1. **Execute SQL** - 执行自定义SQL查询
2. **Migrate Database** - 运行数据库迁移
3. **Print Current Config** - 显示当前配置
4. **Seek QQ Number** - 查询QQ号码

## 依赖说明

- 本项目依赖 `common` 目录下的公共代码
- 通过交互式菜单提供友好的命令行体验
