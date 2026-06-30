/**
 * 扫描引擎
 * 扫描各类缓存目录和大文件（递归版）
 */
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const ruleEngine = require('./rule-engine');

let cancelRequested = false;

// 扫描目录定义
const SCAN_TARGETS = [
  { category: 'temp', name: '用户临时文件', paths: () => [os.tmpdir()] },
  {
    category: 'browser', name: 'Chrome 缓存',
    paths: () => [
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Cache', 'Cache_Data'),
      path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Default', 'Code Cache', 'js'),
    ],
  },
  {
    category: 'browser', name: 'Edge 缓存',
    paths: () => [
      path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache', 'Cache_Data'),
    ],
  },
  {
    category: 'browser', name: '360 浏览器缓存',
    paths: () => [
      path.join(os.homedir(), 'AppData', 'Local', '360Chrome', 'Chrome', 'User Data', 'Default', 'Cache'),
      path.join(os.homedir(), 'AppData', 'Local', '360chrome', 'Chrome', 'User Data', 'Default', 'Cache'),
    ],
  },
  {
    category: 'browser', name: 'Windows Internet 缓存',
    paths: () => [path.join(os.homedir(), 'AppData', 'Local', 'Microsoft', 'Windows', 'INetCache')],
  },
  {
    category: 'app', name: '微信缓存',
    paths: () => [
      path.join(os.homedir(), 'Documents', 'WeChat Files'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Tencent', 'WeChat'),
    ],
  },
  {
    category: 'app', name: 'QQ 缓存',
    paths: () => [
      path.join(os.homedir(), 'Documents', 'Tencent Files'),
      path.join(os.homedir(), 'AppData', 'Roaming', 'Tencent', 'QQ'),
    ],
  },
  {
    category: 'app', name: '钉钉缓存',
    paths: () => [
      path.join(os.homedir(), 'AppData', 'Roaming', 'DingTalk'),
    ],
  },
  {
    category: 'system', name: 'Windows 临时文件',
    paths: () => [path.join(process.env.windir || 'C:\\Windows', 'Temp')],
  },
];

/**
 * 生成扫描项 ID（全局递增计数器保证唯一）
 */
let _idCounter = 0;
function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${(++_idCounter).toString(36)}`;
}

/**
 * 开始标准扫描（多盘版）
 * @param {function} onProgress 进度回调
 * @param {string[]} [drives=['C:\\']] 要扫描的盘符列表
 */
async function startScan(onProgress, drives = ['C:\\']) {
  cancelRequested = false;
  const allItems = [];
  let totalSize = 0;

  // 系统盘符（通常为 C:\）
  const systemDrive = (process.env.SystemDrive || 'C:') + '\\';

  // 构建扫描目标列表
  const targets = [];

  for (const drive of drives) {
    const dl = drive.replace(':\\', '');
    const isSystemDrive = drive.toUpperCase() === systemDrive.toUpperCase();

    if (isSystemDrive) {
      // 系统盘：使用原有的标准扫描路径（无需盘符替换）
      for (const target of SCAN_TARGETS) {
        for (const p of target.paths()) {
          if (!p) continue;
          try {
            await fsp.access(p);
            targets.push({ ...target, resolvedPath: p, driveLetter: dl });
          } catch { /* 路径不存在，跳过 */ }
        }
      }
    } else {
      // 非系统盘：扫描根目录下的常见临时/缓存目录
      const commonDirs = [
        { name: 'Temp', category: 'temp' },
        { name: 'Tmp', category: 'temp' },
        { name: 'Cache', category: 'app' },
        { name: 'Logs', category: 'app' },
      ];
      for (const dir of commonDirs) {
        const dirPath = path.join(drive, dir.name);
        try {
          await fsp.access(dirPath);
          targets.push({
            category: dir.category,
            name: `${dl}盘 ${dir.name}`,
            resolvedPath: dirPath,
            driveLetter: dl,
          });
        } catch { /* 该目录在该盘符下不存在 */ }
      }
    }
  }

  let completed = 0;
  const total = targets.length;

  for (const target of targets) {
    if (cancelRequested) break;
    const prefix = `[${target.driveLetter}] `;

    onProgress({
      current: completed,
      total,
      currentItem: `正在扫描 ${prefix}${target.name}...`,
      phase: `正在扫描垃圾文件...`,
    });

    const items = await scanDirectoryRecursive(target.resolvedPath, target.category, target.name, 0);
    allItems.push(...items);
    totalSize += items.reduce((sum, i) => sum + i.size, 0);
    completed++;

    onProgress({
      current: completed,
      total,
      currentItem: `已扫描 ${prefix}${target.name} (${items.length} 项)`,
      phase: `正在扫描垃圾文件...`,
      batchItems: items,
    });
  }

  return { items: allItems, totalSize };
}

/**
 * 递归扫描目录 — 收集所有文件及其大小
 * @param {number} depth 当前递归深度
 */
async function scanDirectoryRecursive(dirPath, category, sourceName, depth) {
  if (depth > 8) return []; // 限制递归深度，防止无限递归
  if (cancelRequested) return [];

  const items = [];
  let entries;
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return items; // 权限不足等，静默跳过
  }

  for (const entry of entries) {
    if (cancelRequested) break;
    const fullPath = path.join(dirPath, entry.name);
    if (ruleEngine.isExcludedPath(fullPath)) continue;

    try {
      if (entry.isFile()) {
        const stat = await fsp.stat(fullPath);
        // 跳过空文件和系统文件
        if (stat.size === 0) continue;
        if (stat.size < 1024 && category !== 'large-file') continue; // <1KB 跳过

        const safety = ruleEngine.evaluate(fullPath, stat.size, category, { mtimeMs: stat.mtimeMs });
        items.push({
          id: makeId('scan'),
          name: entry.name,
          path: fullPath,
          category,
          size: stat.size,
          safety,
          description: sourceName,
        });
      } else if (entry.isDirectory()) {
        // 对临时目录递归查找文件
        if (category === 'temp' || category === 'system' || category === 'app') {
          const subItems = await scanDirectoryRecursive(fullPath, category, sourceName, depth + 1);
          items.push(...subItems);
        }
      }
    } catch {
      // 权限不足等
    }
  }

  return items;
}

/**
 * 大文件扫描 — 递归遍历目录，收集 >50MB 的文件（多盘版）
 * @param {function} onProgress 进度回调
 * @param {string[]} [drives=['C:\\']] 要扫描的盘符列表
 */
async function startLargeFileScan(onProgress, drives = ['C:\\']) {
  cancelRequested = false;
  const largeFiles = [];
  let scanned = 0;

  // 收集所有选中盘符的第一层非排除目录
  const dirsToScan = [];
  for (const root of drives) {
    try {
      const entries = await fsp.readdir(root, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(root, entry.name);
        if (ruleEngine.isExcludedPath(fullPath)) continue;
        if (entry.isDirectory()) dirsToScan.push(fullPath);
      }
    } catch { /* 权限不足 */ }
  }

  const total = dirsToScan.length;
  const MIN_SIZE = 50 * 1024 * 1024; // 50MB

  for (const dir of dirsToScan) {
    if (cancelRequested) break;
    scanned++;

    onProgress({
      current: scanned, total,
      currentItem: `扫描: ${dir}`,
      phase: `扫描大文件 ${scanned}/${total}`,
    });

    const files = await findLargeFiles(dir, MIN_SIZE, 0);
    largeFiles.push(...files);

    // 该目录的大文件批次，用于前端实时展示
    onProgress({
      current: scanned, total,
      currentItem: `已扫描: ${path.basename(dir)}`,
      phase: `扫描大文件 ${scanned}/${total}`,
      batchItems: files,
    });
  }

  // totalSize 属性方便 UI 使用
  largeFiles.totalSize = largeFiles.reduce((s, f) => s + f.size, 0);
  return largeFiles;
}

/**
 * 递归查找大文件
 */
async function findLargeFiles(dirPath, minSize, depth) {
  if (depth > 6) return [];
  if (cancelRequested) return [];
  const results = [];

  let entries;
  try {
    entries = await fsp.readdir(dirPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    if (cancelRequested) break;
    const fullPath = path.join(dirPath, entry.name);
    if (ruleEngine.isExcludedPath(fullPath)) continue;

    try {
      if (entry.isDirectory()) {
        const sub = await findLargeFiles(fullPath, minSize, depth + 1);
        results.push(...sub);
      } else if (entry.isFile()) {
        const stat = await fsp.stat(fullPath);
        if (stat.size >= minSize) {
          results.push({
            id: makeId('lf'),
            name: entry.name,
            path: fullPath,
            category: 'large-file',
            size: stat.size,
            safety: ruleEngine.evaluate(fullPath, stat.size, 'large-file', { mtimeMs: stat.mtimeMs }),
            description: stat.mtime ? stat.mtime.toLocaleDateString() : '',
          });
        }
      }
    } catch { /* 权限不足跳过 */ }
  }
  return results;
}

function cancelScan() {
  cancelRequested = true;
}

module.exports = { startScan, startLargeFileScan, cancelScan };
