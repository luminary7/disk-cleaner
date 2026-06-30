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
 * 生成扫描项 ID
 */
function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 开始标准扫描
 */
async function startScan(onProgress) {
  cancelRequested = false;
  const allItems = [];
  let totalSize = 0;

  // 收集所有存在的目标路径
  const targets = [];
  for (const target of SCAN_TARGETS) {
    for (const p of target.paths()) {
      if (p) {
        try { await fsp.access(p); } catch { continue; }
        targets.push({ ...target, resolvedPath: p });
      }
    }
  }

  let completed = 0;
  const total = targets.length;

  for (const target of targets) {
    if (cancelRequested) break;

    // 发送扫描开始通知
    onProgress({
      current: completed,
      total,
      currentItem: `正在扫描: ${target.name}...`,
      phase: `正在扫描垃圾文件...`,
    });

    const items = await scanDirectoryRecursive(target.resolvedPath, target.category, target.name, 0);
    allItems.push(...items);
    totalSize += items.reduce((sum, i) => sum + i.size, 0);
    completed++;

    // 发送该目录下发现的所有文件，用于前端实时展示
    onProgress({
      current: completed,
      total,
      currentItem: `已扫描: ${target.name} (${items.length} 项)`,
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
 * 大文件扫描 — 递归遍历目录，收集 >50MB 的文件
 */
async function startLargeFileScan(onProgress) {
  cancelRequested = false;
  const largeFiles = [];
  const rootDirs = ['C:\\'];
  let scanned = 0;

  // 收集第一层非排除目录
  const dirsToScan = [];
  for (const root of rootDirs) {
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
