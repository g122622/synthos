#!/usr/bin/env node

/**
 * launchAll.js - 构建所有monorepo子项目的脚本
 * 按指定顺序构建项目，每个项目之间间隔5秒
 */

const { spawn } = require('child_process');
const path = require('path');

// 构建顺序配置（可按需调整）
// 注意：orchestrator 需要在所有任务处理器启动后再启动，以确保任务已注册
const buildOrder = [
    'orchestrator',  // Pipeline 调度器，需要先启动
    'preprocessing',
    'ai-model',
    'webui-backend',
    'webui-frontend',
    // 'webui-forwarder', // TODO 目前无法正常启动，待解决
    'data-provider'
];

// 项目根目录
const rootDir = path.resolve(__dirname, '..');

// 构建间隔时间（毫秒）
const buildInterval = 3000;

/**
 * 执行构建命令
 * @param {string} projectName - 项目名称
 * @returns {Promise<void>}
 */
function buildProject(projectName) {
    return new Promise((resolve, reject) => {
        console.log(`\n🚀 开始构建并运行项目: ${projectName}`);
        console.log(`📁 项目路径: ${path.join(rootDir, 'apps', projectName)}`);

        const projectPath = path.join(rootDir, 'apps', projectName);
        const buildProcess = spawn('npm', ['run', 'dev'], {
            cwd: projectPath,
            stdio: ['ignore', 'inherit', 'inherit'], // [stdin, stdout, stderr] - inherit stdout and stderr
            shell: true
        });

        // 明确监听输出事件并转发到当前控制台
        buildProcess.stdout?.on('data', (data) => {
            process.stdout.write(data);
        });

        buildProcess.stderr?.on('data', (data) => {
            process.stderr.write(data);
        });

        buildProcess.on('close', (code) => {
            if (code === 0) {
                console.log(`⚠️ 项目 ${projectName} 已退出，退出码为0`);
                resolve();
            } else {
                console.error(`❌ 项目 ${projectName} 构建or运行失败，退出码不为0: ${code}`);
                // 重启失败的项目
                console.log(`🔄 尝试5min后重启项目 ${projectName}...`);
                setTimeout(() => {
                    buildProject(projectName).then(resolve).catch(reject);
                }, 5 * 60 * 1000); // 5min后重试
            }
        });

        buildProcess.on('error', (error) => {
            console.error(`❌ 启动项目 ${projectName} 构建or运行时出错:`, error);
            reject(error);
        });

        resolve();
    });
}

/**
 * 延迟函数
 * @param {number} ms - 延迟毫秒数
 * @returns {Promise<void>}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 顺序构建所有项目
 */
async function buildAllProjects() {
    console.log(`🏗️ 开始构建&运行所有项目，总共 ${buildOrder.length} 个`);
    console.log(`📋 构建顺序: ${buildOrder.join(' → ')}`);

    for (let i = 0; i < buildOrder.length; i++) {
        const projectName = buildOrder[i];

        try {
            await buildProject(projectName);

            // 如果不是最后一个项目，则等待
            if (i < buildOrder.length - 1) {
                console.log(`⏳ 等待 ${buildInterval / 1000} 秒后开始下一个项目...`);
                await delay(buildInterval);
            }
        } catch (error) {
            console.error(`💥 构建&运行过程中发生错误:`, error);
            process.exit(1);
        }
    }

    console.log('\n🎉 所有项目构建完成！');
}

// 执行构建
buildAllProjects().catch(error => {
    console.error('构建&运行过程发生未预期错误:', error);
    process.exit(1);
});