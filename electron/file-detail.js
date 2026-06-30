/**
 * 获取单文件的详细信息（元数据）
 */
const fsp = require('fs').promises;
const path = require('path');

function formatSize(bytes) {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return bytes + ' B';
}

/**
 * 获取文件的详细元信息
 * @param {string} filePath 文件绝对路径
 * @param {object} item 已有的 ScanItem 数据（含 safety、category）
 * @returns {object} 详细的文件元信息对象
 */
async function getFileDetail(filePath, item) {
  const stat = await fsp.stat(filePath);
  const parsed = path.parse(filePath);

  return {
    // 基础信息
    name: parsed.base,
    path: filePath,
    dir: parsed.dir,
    ext: parsed.ext.toLowerCase() || '(无扩展名)',
    size: stat.size,
    sizeFormatted: formatSize(stat.size),

    // 时间信息 — 转成本地可读字符串
    created: stat.birthtime ? stat.birthtime.toLocaleString('zh-CN') : '未知',
    modified: stat.mtime ? stat.mtime.toLocaleString('zh-CN') : '未知',
    accessed: stat.atime ? stat.atime.toLocaleString('zh-CN') : '未知',

    // 文件属性
    isHidden: false, // 下面通过路径判断
    isSystem: false,
    readonly: false,

    // 引用原有扫描信息
    safety: item.safety,
    category: item.category,
  };
}

module.exports = { getFileDetail };
