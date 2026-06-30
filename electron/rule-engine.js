/**
 * 内置规则引擎
 * 离线判断每条扫描项的安全等级
 */

// 系统目录黑名单 — 永远不扫描、不删除
const SYSTEM_EXCLUSIONS = [
  /^[A-Z]:\\Windows/i,
  /^[A-Z]:\\Program Files\\/i,
  /^[A-Z]:\\Program Files \(x86\)\\/i,
  /^[A-Z]:\\ProgramData/i,
  /^[A-Z]:\\Boot/i,
  /^[A-Z]:\\System Volume Information/i,
  /^[A-Z]:\\\$Recycle\.Bin/i,
  /^[A-Z]:\\Recovery/i,
];

// 系统关键文件类型 — 即使不在系统目录也警告
const SYSTEM_FILE_EXTS = [
  '.sys', '.dll', '.exe', '.ocx', '.drv', '.cpl',
];

/**
 * 检查路径是否在排除列表中
 */
function isExcludedPath(filePath) {
  return SYSTEM_EXCLUSIONS.some((pattern) => pattern.test(filePath));
}

/**
 * 根据文件信息判断安全等级
 * @param {string} filePath
 * @param {number} size 字节数
 * @param {string} category 类别
 * @param {object} extra 额外信息，如 mtimeMs
 * @returns {'safe' | 'caution' | 'keep'}
 */
function evaluate(filePath, size, category, extra = {}) {
  const ext = filePath.split('.').pop()?.toLowerCase();

  // 系统文件类型 → 建议保留
  if (SYSTEM_FILE_EXTS.includes('.' + ext)) {
    return 'keep';
  }

  // 位于排除目录下的文件 → 建议保留
  if (isExcludedPath(filePath)) {
    return 'keep';
  }

  switch (category) {
    case 'temp':
      return evaluateTemp(extra);
    case 'browser':
      return evaluateBrowser(extra);
    case 'app':
      return evaluateAppCache(extra);
    case 'system':
      return 'caution';
    case 'large-file':
      return evaluateLargeFile(size, extra);
    default:
      return 'caution';
  }
}

function evaluateTemp(extra) {
  // 临时文件目录可以直接清，不设时间门槛
  return 'safe';
}

function evaluateBrowser(extra) {
  // 浏览器缓存：7天前的可以安全清理
  const ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 168) return 'safe'; // 7天
  return 'caution';
}

function evaluateAppCache(extra) {
  // 应用缓存：3天前的可以安全清理
  const ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 72) return 'safe';
  return 'caution';
}

function evaluateLargeFile(size, extra) {
  // 大文件分析：超过1GB提醒注意
  if (size > 1073741824) return 'caution'; // >1GB
  return 'safe';
}

function getAgeHours(mtimeMs) {
  if (!mtimeMs) return 999;
  return (Date.now() - mtimeMs) / 3600000;
}

module.exports = {
  evaluate,
  isExcludedPath,
  SYSTEM_EXCLUSIONS,
};
