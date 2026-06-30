/**
 * 文件操作层
 * 负责移至回收站、还原点创建、安全检查
 */
const { shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ruleEngine = require('./rule-engine');
const logger = require('./logger');

/**
 * 将指定文件/文件夹移入回收站，带安全校验
 * @param {string} itemPath
 * @returns {{ success: boolean, error?: string }}
 */
async function moveToTrash(itemPath) {
  // 安全检查：排除列表校验
  if (ruleEngine.isExcludedPath(itemPath)) {
    return { success: false, error: `路径受保护: ${itemPath}` };
  }

  try {
    const result = await shell.trashItem(itemPath);
    logger.writeLog('trash', itemPath, getSize(itemPath));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 批量移至回收站
 */
async function moveBatchToTrash(items) {
  const results = [];
  for (const item of items) {
    const result = await moveToTrash(item.path);
    results.push({ ...item, success: result.success, error: result.error });
  }
  return results;
}

/**
 * 创建 Windows 系统还原点
 */
function createSystemRestorePoint() {
  try {
    const desc = 'C盘清理工具 - 清理前备份';
    // 使用 PowerShell 创建还原点
    const cmd = `
      powershell -Command "
        Checkpoint-Computer -Description '${desc}' -RestorePointType MODIFY_SETTINGS
      "
    `;
    execSync(cmd, { timeout: 60000, stdio: 'pipe' });
    return { success: true, message: '系统还原点创建成功' };
  } catch (err) {
    return { success: false, message: `还原点创建失败: ${err.message}` };
  }
}

function getSize(itemPath) {
  try {
    const stat = fs.statSync(itemPath);
    if (stat.isFile()) return stat.size;
    // 目录大小粗略估算
    let total = 0;
    const walk = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        try {
          if (entry.isFile()) total += fs.statSync(full).size;
          else if (entry.isDirectory()) walk(full);
        } catch { /* 权限不足跳过 */ }
      }
    };
    walk(itemPath);
    return total;
  } catch {
    return 0;
  }
}

module.exports = {
  moveToTrash,
  moveBatchToTrash,
  createSystemRestorePoint,
};
