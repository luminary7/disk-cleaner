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

function normalizeItem(itemOrPath) {
  if (typeof itemOrPath === 'string') {
    return { path: itemOrPath };
  }
  return itemOrPath || {};
}

function isRootLikePath(itemPath) {
  const normalized = path.normalize(itemPath);
  const parsed = path.parse(normalized);
  return normalized.toLowerCase() === parsed.root.toLowerCase();
}

function getItemSizeAndSafety(item, normalizedPath) {
  const stat = fs.statSync(normalizedPath);
  if (!stat.isFile()) {
    return {
      size: getSize(normalizedPath),
      safety: item.safety || 'caution',
    };
  }

  const category = item.category || 'large-file';
  const size = stat.size;
  const safety = ruleEngine.evaluate(normalizedPath, size, category, { mtimeMs: stat.mtimeMs });
  return { size, safety };
}

/**
 * 将指定文件/文件夹移入回收站，带安全校验
 * @param {string|object} itemOrPath
 * @param {{ allowCaution?: boolean, forceKeep?: boolean, skipValidation?: boolean }} options
 *        skipValidation — 跳过 fs.stat/evaluate（批量清理时使用已有的扫描结果，大幅提升性能）
 * @returns {{ success: boolean, error?: string }}
 */
async function moveToTrash(itemOrPath, options = {}) {
  const item = normalizeItem(itemOrPath);
  const itemPath = item.path;

  if (!itemPath) {
    return { success: false, error: '缺少文件路径' };
  }

  const normalizedPath = path.normalize(itemPath);

  if (isRootLikePath(normalizedPath)) {
    return { success: false, error: `禁止清理磁盘根目录: ${normalizedPath}` };
  }

  // 安全检查：排除列表校验
  if (ruleEngine.isExcludedPath(normalizedPath)) {
    return { success: false, error: `路径受保护: ${normalizedPath}` };
  }

  if (options.skipValidation) {
    // 快速路径：使用扫描结果中的 safety，跳过文件系统查询（stat + 目录遍历 + rule evaluation）
    // 这些在扫描阶段已全部完成，无需重复执行
    const safety = item.safety || 'caution';
    if (safety === 'keep' && !options.forceKeep) {
      return { success: false, error: `安全策略阻止删除: ${normalizedPath}` };
    }
    if (safety === 'caution' && !options.allowCaution) {
      return { success: false, error: `谨慎项需要确认后清理: ${normalizedPath}` };
    }
    try {
      await shell.trashItem(normalizedPath);
      const size = item.size || 0;
      logger.writeLog('trash', normalizedPath, size);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  // 完整路径：实时 stat + rule evaluation（单文件删除 / 非扫描来源使用）
  try {
    const { size, safety } = getItemSizeAndSafety(item, normalizedPath);
    if (safety === 'keep' && !options.forceKeep) {
      return { success: false, error: `安全策略阻止删除: ${normalizedPath}` };
    }
    if (safety === 'caution' && !options.allowCaution) {
      return { success: false, error: `谨慎项需要确认后清理: ${normalizedPath}` };
    }

    await shell.trashItem(normalizedPath);
    logger.writeLog('trash', normalizedPath, size);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * 快速批量移至回收站
 * 利用扫描结果中的 safety/size，跳过冗余的文件系统查询和规则重评估
 * @param {Array} items - 扫描结果 items（自带 size/safety）
 * @param {{ allowCaution?: boolean, forceKeep?: boolean }} options
 * @param {(current: number, total: number) => void} [onProgress]
 * @returns {Promise<Array>}
 */
async function moveBatchToTrash(items, options = {}, onProgress) {
  const total = items.length;
  const results = new Array(total);

  // 阶段1：同步校验（仅路径匹配，无磁盘 I/O）
  const validItems = [];
  for (let i = 0; i < total; i++) {
    const item = items[i];
    const itemPath = item.path;

    if (!itemPath) {
      results[i] = { ...item, success: false, error: '缺少文件路径' };
      continue;
    }

    const normalizedPath = path.normalize(itemPath);

    if (isRootLikePath(normalizedPath)) {
      results[i] = { ...item, success: false, error: `禁止清理磁盘根目录: ${normalizedPath}` };
      continue;
    }
    if (ruleEngine.isExcludedPath(normalizedPath)) {
      results[i] = { ...item, success: false, error: `路径受保护: ${normalizedPath}` };
      continue;
    }

    const safety = item.safety || 'caution';
    if (safety === 'keep' && !options.forceKeep) {
      results[i] = { ...item, success: false, error: `安全策略阻止删除: ${normalizedPath}` };
      continue;
    }
    if (safety === 'caution' && !options.allowCaution) {
      results[i] = { ...item, success: false, error: `谨慎项需要确认后清理: ${normalizedPath}` };
      continue;
    }

    validItems.push({ index: i, item, normalizedPath });
  }

  // 阶段2：并发执行 shell.trashItem（跳过 stat/evaluate，直接移入回收站）
  const CONCURRENCY = 200;
  let completed = 0;
  let nextIdx = 0;
  const logEntries = [];

  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= validItems.length) break;
      const { index, item, normalizedPath } = validItems[idx];
      try {
        await shell.trashItem(normalizedPath);
        const size = item.size || 0;
        logEntries.push({ action: 'trash', filePath: normalizedPath, size });
        results[index] = { ...item, success: true };
      } catch (err) {
        results[index] = { ...item, success: false, error: err.message };
      }
      onProgress?.(++completed, total);
    }
  }

  const poolSize = Math.min(CONCURRENCY, validItems.length);
  await Promise.all(Array.from({ length: poolSize }, () => worker()));

  // 批量写入日志（一次文件 I/O 代替 N 次）
  logger.writeBatchLog(logEntries);

  return results;
}

/**
 * 创建 Windows 系统还原点
 */
function createSystemRestorePoint() {
  try {
    const desc = '我的磁盘怎么红红的，是要谈恋爱了吗 - 清理前备份';
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

/**
 * 从回收站批量还原文件
 * 通过 PowerShell Shell.Application COM 对象查找回收站中的文件并还原
 * 使用 .ps1 临时文件执行，避免 -Command 引号转义问题
 * @param {Array<{ path: string }>} items
 * @param {(current: number, total: number, itemName: string) => void} [onProgress]
 * @returns {{ restored: number, failed: number, errors: string[] }}
 */
async function restoreFromTrash(items, onProgress) {
  const tmpDir = require('os').tmpdir();
  const timestamp = Date.now();
  const tmpFile = path.join(tmpDir, `clean-restore-${timestamp}.json`);
  const psFile = path.join(tmpDir, `clean-restore-${timestamp}.ps1`);
  const paths = items.map(i => i.path);

  // 将待还原路径写入临时 JSON 文件
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(paths), 'utf8');
  } catch (err) {
    return { restored: 0, failed: items.length, errors: [`无法写入临时文件: ${err.message}`] };
  }

  try {
    // 将 PowerShell 脚本写入临时 .ps1 文件（避免 -Command 引号转义问题）
    const psScript = `$paths = Get-Content '${tmpFile.replace(/'/g, "''")}' -Raw | ConvertFrom-Json
$shell = New-Object -ComObject Shell.Application
$recycleBin = $shell.NameSpace(0xa)
$results = @()

foreach ($targetPath in $paths) {
  $found = $false
  foreach ($rItem in $recycleBin.Items()) {
    $orig = $recycleBin.GetDetailsOf($rItem, 1)
    if ($orig -eq $targetPath) {
      try {
        $rItem.InvokeVerb("restore")
        $results += @{ Path = $targetPath; Success = $true }
      } catch {
        $results += @{ Path = $targetPath; Success = $false; Error = $_.Exception.Message }
      }
      $found = $true
      break
    }
  }
  if (-not $found) {
    $results += @{ Path = $targetPath; Success = $false; Error = "NotInRecycleBin" }
  }
}

$results | ConvertTo-Json -Compress
`;
    fs.writeFileSync(psFile, psScript, 'utf8');

    const output = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile.replace(/"/g, '\\"')}"`,
      { timeout: 120000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(output.trim());
    // 进度回调
    for (let i = 0; i < parsed.length; i++) {
      const item = items[i] || {};
      onProgress?.(i + 1, items.length, item.name || '');
    }

    const restored = parsed.filter(r => r.Success).length;
    const failed = parsed.filter(r => !r.Success).length;
    // 如果全部是 NotInRecycleBin，可能是列索引不对，尝试用列 0（名称）+ 列 2（原始路径的备用方案）
    if (restored === 0 && failed > 0 && parsed.every(r => r.Error === 'NotInRecycleBin')) {
      return await restoreFromTrashFallback(items, onProgress);
    }
    return {
      restored,
      failed,
      errors: parsed.filter(r => !r.Success).map(r => r.Error || r.Path),
    };
  } catch (err) {
    return { restored: 0, failed: items.length, errors: [`PowerShell 执行失败: ${err.message}`] };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
    try { fs.unlinkSync(psFile); } catch {}
  }
}

/**
 * 备用方案：尝试不同的列索引组合
 * 某些 Windows 版本/语言环境下，"原始位置"可能不在列 1
 */
async function restoreFromTrashFallback(items, onProgress) {
  const tmpDir = require('os').tmpdir();
  const timestamp = Date.now();
  const tmpFile = path.join(tmpDir, `clean-restore-fb-${timestamp}.json`);
  const psFile = path.join(tmpDir, `clean-restore-fb-${timestamp}.ps1`);
  const paths = items.map(i => i.path);

  try {
    fs.writeFileSync(tmpFile, JSON.stringify(paths), 'utf8');

    // 尝试列 0（名称，可能包含完整路径）和列 2 作为备选
    const psScript = `$paths = Get-Content '${tmpFile.replace(/'/g, "''")}' -Raw | ConvertFrom-Json
$shell = New-Object -ComObject Shell.Application
$recycleBin = $shell.NameSpace(0xa)
$results = @()

foreach ($targetPath in $paths) {
  $found = $false
  $targetName = [System.IO.Path]::GetFileName($targetPath)
  foreach ($rItem in $recycleBin.Items()) {
    $col0 = $recycleBin.GetDetailsOf($rItem, 0)
    $col2 = $recycleBin.GetDetailsOf($rItem, 2)
    # 尝试列 0 完整匹配、列 2 完整匹配、或名称匹配后校验完整路径
    if ($col0 -eq $targetPath -or $col2 -eq $targetPath -or $col0 -eq $targetName) {
      try {
        $rItem.InvokeVerb("restore")
        $results += @{ Path = $targetPath; Success = $true }
      } catch {
        $results += @{ Path = $targetPath; Success = $false; Error = $_.Exception.Message }
      }
      $found = $true
      break
    }
  }
  if (-not $found) {
    $results += @{ Path = $targetPath; Success = $false; Error = "NotInRecycleBin" }
  }
}

$results | ConvertTo-Json -Compress
`;
    fs.writeFileSync(psFile, psScript, 'utf8');

    const output = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${psFile.replace(/"/g, '\\"')}"`,
      { timeout: 120000, encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
    );

    const parsed = JSON.parse(output.trim());
    for (let i = 0; i < parsed.length; i++) {
      const item = items[i] || {};
      onProgress?.(i + 1, items.length, item.name || '');
    }
    return {
      restored: parsed.filter(r => r.Success).length,
      failed: parsed.filter(r => !r.Success).length,
      errors: parsed.filter(r => !r.Success).map(r => r.Error || r.Path),
    };
  } catch (err) {
    return { restored: 0, failed: items.length, errors: [`PowerShell 执行失败: ${err.message}`] };
  } finally {
    try { fs.unlinkSync(tmpFile); } catch {}
    try { fs.unlinkSync(psFile); } catch {}
  }
}

module.exports = {
  moveToTrash,
  moveBatchToTrash,
  createSystemRestorePoint,
  restoreFromTrash,
};
