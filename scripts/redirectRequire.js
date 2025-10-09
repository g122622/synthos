// 脚本描述：构建结束后将类似 require("@root/common/util/Logger") 的语句路径替换为 require("../../../common/dist/util/Logger")

const Logger = require('./Logger');
const fs = require('fs');
const path = require('path');

Logger.bgBlue('[Redirect] 🧐 开始处理');

// 工具函数：递归遍历指定目录下的所有文件
function traverseDirectory(basePath, callback) {
    fs.readdirSync(basePath).forEach(file => {
        const filePath = `${basePath}/${file}`;
        if (fs.statSync(filePath).isDirectory()) {
            traverseDirectory(filePath, callback);
        } else {
            callback(filePath);
        }
    });
}

// 扫描 ../apps/下的所有文件夹
const appsDir = path.join(__dirname, '../apps/');
const apps = fs.readdirSync(appsDir);

// 遍历每个文件夹
apps.forEach(app => {
    if (['.DS_Store', 'thumbs.db'].includes(app)) return;
    const appDir = `${appsDir}${app}/`;
    Logger.info(`[Redirect] 开始处理：${appDir}`);
    const files = fs.readdirSync(appDir);
    if (files.includes('dist')) {
        const distDir = `${appDir}dist`;
        traverseDirectory(distDir, filePath => {
            if (filePath.endsWith('.js')) {
                const content = fs.readFileSync(filePath, 'utf8');
                let newContent = content;

                newContent = content.replace(/require\("@root\/common\/([^"]*)"\)/g, (match, p1) => {
                    // 当前文件相对于项目根的路径：假设脚本在 scripts/ 下，项目根是 ../
                    // filePath 是绝对或相对于脚本的路径，比如 '../apps/app1/dist/utils/a.js'
                    const fileDir = path.dirname(filePath);
                    // 项目根目录（脚本在 scripts/，项目根是 path.join(__dirname, '..')）
                    const projectRoot = path.join(__dirname, '..');
                    // 计算从当前文件到 common/dist/... 的相对路径
                    const relativePath = path.relative(fileDir, path.join(projectRoot, 'common/dist', p1));
                    // 转为 POSIX 路径（避免 Windows \ 问题）
                    const posixRelativePath = relativePath.split(path.sep).join('/');

                    Logger.info(`[Redirect] 文件路径：${filePath}，匹配到的路径：${match}，替换为：${posixRelativePath}`);
                    return `require("${posixRelativePath}")`;
                });

                if (content !== newContent) {
                    fs.writeFileSync(filePath, newContent, 'utf8');
                    Logger.info(`[Redirect] 文件路径：${filePath} 写回成功`);
                }
            }
        })
    }
})

Logger.bgGreen('[Redirect] 🥳🥳🥳 处理完成!');
