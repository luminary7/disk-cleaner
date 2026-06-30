/**
 * 内置规则引擎
 * 离线判断每条扫描项的安全等级
 *
 * 分级参考：
 *   keep    — 建议保留（系统文件、应用本体，删除可能导致异常）
 *   caution — 谨慎删除（用户数据、游戏资源、可执行模块，需人工确认）
 *   safe    — 可安全删除（纯缓存、临时文件，可再生且不影响功能）
 */

// 系统目录黑名单 — keep，永远不扫不删
// 注意：不屏蔽整个 Windows，只屏蔽核心子目录，允许扫描 Temp/Prefetch 等可清理目录
const SYSTEM_EXCLUSIONS = [
  // Windows 系统核心
  /^[A-Z]:\\Windows\\System32\\/i,
  /^[A-Z]:\\Windows\\SysWOW64\\/i,
  /^[A-Z]:\\Windows\\WinSxS\\/i,
  /^[A-Z]:\\Windows\\assembly\\/i,
  /^[A-Z]:\\Windows\\Microsoft\.NET\\/i,
  /^[A-Z]:\\Windows\\Installer\\/i,
  /^[A-Z]:\\Windows\\servicing\\/i,
  /^[A-Z]:\\Windows\\Globalization\\/i,
  /^[A-Z]:\\Windows\\AppReadiness\\/i,
  // 应用程序目录
  /^[A-Z]:\\Program Files\\/i,
  /^[A-Z]:\\Program Files \(x86\)\\/i,
  /^[A-Z]:\\ProgramData\\WindowsApps\\/i,
  // 系统卷
  /^[A-Z]:\\Boot/i,
  /^[A-Z]:\\System Volume Information/i,
  /^[A-Z]:\\\$Recycle\.Bin/i,
  /^[A-Z]:\\Recovery/i,
];

// 用户数据目录标记 — caution（含用户数据或判断成本高）
// 用字符串 includes 而非正则，避免 Windows 反斜杠转义问题
var CAUTION_DIR_MARKS = [
  '\\appdata\\roaming\\',
  '\\documents\\',
  '\\desktop\\',
  '\\downloads\\',
  '\\pictures\\',
  '\\videos\\',
  '\\music\\',
  '\\game\\',
  '\\games\\',
  '\\steam\\',
  '\\steamapps\\',       // Steam 游戏库
  '\\epic\\',             // Epic 游戏库
  '\\common\\',           // Steam 通用游戏安装目录
  '_data\\',              // Unity 游戏数据目录
  '\\minecraft\\',
  '\\projects\\',
  '\\backup\\',
  '\\onedrive\\',
  '\\dropbox\\',
  '\\wsl\\',              // WSL 子系统
  '\\node_modules\\',     // node 依赖
  '\\vendor\\',            // PHP/其他依赖
  '\\python\\',
  '\\anaconda\\',
  '\\miniconda\\',
  '\\envs\\',
];

// 系统关键文件类型 — keep
const SYSTEM_FILE_EXTS = [
  '.sys', '.ocx', '.drv', '.cpl',
];

// 可执行模块 — caution（可删但需确认）
const CAUTION_FILE_EXTS = [
  '.dll', '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs',
];

// 安装包/压缩包 — 在缓存目录 safe
const PACKAGE_EXTS = [
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso',
];

// 已知可清理的缓存/临时文件扩展名
const CACHE_SAFE_EXTS = [
  '.tmp', '.log', '.cache', '.bak', '.old', '.dmp', '.swp',
  '.js', '.ts', '.css', '.html', '.htm', '.json', '.xml', '.yaml', '.yml',
  '.txt', '.md', '.csv', '.ini', '.cfg',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.bmp', '.webp',
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
  '.mp3', '.wav', '.flac', '.aac', '.ogg',
  '.db', '.sqlite', '.sqlite3',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
];

// 所有已知扩展名合并（用于未知扩展名校验）
var KNOWN_EXTS = SYSTEM_FILE_EXTS.concat(CAUTION_FILE_EXTS, PACKAGE_EXTS, CACHE_SAFE_EXTS);

function isExcludedPath(filePath) {
  return SYSTEM_EXCLUSIONS.some(function (pattern) { return pattern.test(filePath); });
}

function isCautionPath(filePath) {
  var lower = filePath.toLowerCase();
  return CAUTION_DIR_MARKS.some(function (mark) { return lower.indexOf(mark) !== -1; });
}

function getExt(filePath) {
  var parts = filePath.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function evaluate(filePath, size, category, extra) {
  extra = extra || {};
  var ext = getExt(filePath);

  // keep 判定
  if (SYSTEM_FILE_EXTS.indexOf('.' + ext) !== -1) return 'keep';
  if (isExcludedPath(filePath)) return 'keep';

  // caution 判定（通用）
  if (CAUTION_FILE_EXTS.indexOf('.' + ext) !== -1) return 'caution';

  // 无后缀或不在已知列表 → 不删除（未知文件类型，可能是游戏资源/数据等）
  if (!ext) return 'keep';
  if (KNOWN_EXTS.indexOf('.' + ext) === -1) return 'keep';

  // 按类别细分
  switch (category) {
    case 'temp':
      return 'safe';
    case 'browser':
      return evaluateBrowser(extra);
    case 'app':
      return evaluateAppCache(extra);
    case 'system':
      return 'caution';
    case 'large-file':
      if (isCautionPath(filePath)) return 'caution';
      return evaluateLargeFile(size, filePath);
    default:
      return 'caution';
  }
}

function evaluateBrowser(extra) {
  var ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 168) return 'safe';
  return 'caution';
}

function evaluateAppCache(extra) {
  var ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 72) return 'safe';
  return 'caution';
}

function evaluateLargeFile(size, filePath) {
  var ext = getExt(filePath);
  // 安装包/压缩包 → 可安全删
  if (PACKAGE_EXTS.indexOf('.' + ext) !== -1) return 'safe';
  // 超大文件 > 1GB → 谨慎
  if (size > 1073741824) return 'caution';
  // 其余大文件一律 caution（可能是游戏资源、用户数据等）
  return 'caution';
}

function getAgeHours(mtimeMs) {
  if (!mtimeMs) return 999;
  return (Date.now() - mtimeMs) / 3600000;
}

module.exports = {
  evaluate: evaluate,
  isExcludedPath: isExcludedPath,
  SYSTEM_EXCLUSIONS: SYSTEM_EXCLUSIONS,
};
