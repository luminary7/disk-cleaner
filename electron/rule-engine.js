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
var USER_DATA_DIR_MARKS = [
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

// 已知清理用途目录 — 只有这些缓存/日志/临时目录允许按年龄降级为 safe
var CLEANUP_DIR_MARKS = [
  '\\temp\\',
  '\\tmp\\',
  '\\cache\\',
  '\\cache_data\\',
  '\\code cache\\',
  '\\gpucache\\',
  '\\inetcache\\',
  '\\logs\\',
  '\\log\\',
  '\\xlog\\',
  '\\crash\\',
  '\\crashes\\',
  '\\dump\\',
  '\\dumps\\',
  '\\thumb\\',
  '\\thumbnail\\',
  '\\thumbnails\\',
  '\\windows\\temp\\',
  '\\windows\\prefetch\\',
  '\\windows\\logs\\',
  '\\softwaredistribution\\download\\',
  '\\microsoft\\windows\\wer\\',
  '\\microsoft\\windows\\explorer\\',
];

// 大文件高风险目录 — keep
var HIGH_RISK_DIR_MARKS = [
  '\\game\\',
  '\\games\\',
  '\\steam\\',
  '\\steamapps\\',
  '\\epic\\',
  '\\common\\',
  '_data\\',
  '\\minecraft\\',
  '\\projects\\',
  '\\node_modules\\',
  '\\vendor\\',
  '\\python\\',
  '\\anaconda\\',
  '\\miniconda\\',
  '\\envs\\',
  '\\wsl\\',
  '\\virtual machines\\',
  '\\vms\\',
];

// 系统关键文件类型 — keep
const SYSTEM_FILE_EXTS = [
  '.sys', '.ocx', '.drv', '.cpl',
];

// 可执行模块 — caution（可删但需确认）
const CAUTION_FILE_EXTS = [
  '.dll', '.exe', '.msi', '.bat', '.cmd', '.ps1', '.vbs',
];

// 安装包/压缩包 — 在缓存目录可按年龄降级，其他位置需确认
const PACKAGE_EXTS = [
  '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz', '.iso', '.img',
];

// 虚拟磁盘/镜像与常见游戏资源 — keep
const HIGH_RISK_FILE_EXTS = [
  '.vhd', '.vhdx', '.vmdk', '.qcow2', '.pak', '.obb',
];

// 数据库、密钥、证书、配置等结构性高价值文件 — 非缓存目录 keep
const STRUCTURAL_FILE_EXTS = [
  '.db', '.sqlite', '.sqlite3',
  '.env', '.key', '.pem', '.pfx', '.p12', '.crt', '.cer',
  '.kdbx', '.wallet',
  '.conf', '.config', '.toml', '.yaml', '.yml', '.ini', '.cfg',
];

// AI 模型/权重资产 — 大文件扫描中默认 caution，由用户确认
const MODEL_FILE_EXTS = [
  '.safetensors', '.ckpt', '.pt', '.pth', '.onnx', '.gguf',
  '.bin', '.model', '.weights', '.h5', '.pb', '.tflite',
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
var KNOWN_EXTS = SYSTEM_FILE_EXTS.concat(
  CAUTION_FILE_EXTS,
  PACKAGE_EXTS,
  HIGH_RISK_FILE_EXTS,
  STRUCTURAL_FILE_EXTS,
  MODEL_FILE_EXTS,
  CACHE_SAFE_EXTS
);

function isExcludedPath(filePath) {
  return SYSTEM_EXCLUSIONS.some(function (pattern) { return pattern.test(filePath); });
}

function isCautionPath(filePath) {
  var lower = filePath.toLowerCase();
  return USER_DATA_DIR_MARKS.some(function (mark) { return lower.indexOf(mark) !== -1; });
}

function isCleanupPath(filePath) {
  var lower = filePath.toLowerCase();
  return CLEANUP_DIR_MARKS.some(function (mark) { return lower.indexOf(mark) !== -1; });
}

function isHighRiskPath(filePath) {
  var lower = filePath.toLowerCase();
  return HIGH_RISK_DIR_MARKS.some(function (mark) { return lower.indexOf(mark) !== -1; });
}

function getExt(filePath) {
  var parts = filePath.split('.');
  return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function evaluate(filePath, size, category, extra) {
  extra = extra || {};
  var ext = getExt(filePath);
  var dotExt = ext ? '.' + ext : '';

  // keep 判定
  if (SYSTEM_FILE_EXTS.indexOf(dotExt) !== -1) return 'keep';
  if (HIGH_RISK_FILE_EXTS.indexOf(dotExt) !== -1) return 'keep';
  if (isExcludedPath(filePath)) return 'keep';
  if (category === 'large-file' && isHighRiskPath(filePath)) return 'keep';
  if (isStructuralFile(dotExt) && !isCleanupPath(filePath)) return 'keep';

  // caution 判定（通用）
  if (CAUTION_FILE_EXTS.indexOf(dotExt) !== -1) return 'caution';

  // 无后缀或不在已知列表 → 不确定但不直接锁死，交给用户确认
  if (!ext) return 'caution';
  if (KNOWN_EXTS.indexOf(dotExt) === -1) return 'caution';

  // 按类别细分
  switch (category) {
    case 'temp':
      return evaluateTemp(extra);
    case 'browser':
      return evaluateBrowser(extra);
    case 'app':
      if (isCautionPath(filePath) && !isCleanupPath(filePath)) return 'caution';
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

function evaluateTemp(extra) {
  var ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 24) return 'safe';
  return 'caution';
}

function evaluateBrowser(extra) {
  var ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 168) return 'safe';
  return 'caution';
}

function evaluateAppCache(extra) {
  var ageHours = getAgeHours(extra.mtimeMs);
  if (ageHours > 168) return 'safe';
  return 'caution';
}

function evaluateLargeFile(size, filePath) {
  var ext = getExt(filePath);
  // 安装包/压缩包/镜像在全盘大文件扫描中也需要人工确认
  if (PACKAGE_EXTS.indexOf('.' + ext) !== -1) return 'caution';
  // 模型、素材、备份、未知类型等普通大文件默认交给用户确认
  return 'caution';
}

function isStructuralFile(dotExt) {
  return STRUCTURAL_FILE_EXTS.indexOf(dotExt) !== -1;
}

function getAgeHours(mtimeMs) {
  if (!mtimeMs) return 999;
  return (Date.now() - mtimeMs) / 3600000;
}

module.exports = {
  evaluate: evaluate,
  isExcludedPath: isExcludedPath,
  isCautionPath: isCautionPath,
  isCleanupPath: isCleanupPath,
  SYSTEM_EXCLUSIONS: SYSTEM_EXCLUSIONS,
};
