/**
 * 操作日志模块
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const LOGS_DIR = 'logs';

function getLogsDir() {
  const userDataPath = app.getPath('userData');
  const dir = path.join(userDataPath, LOGS_DIR);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function getTodayLogFile() {
  const date = new Date().toISOString().slice(0, 10);
  return path.join(getLogsDir(), `clean-${date}.log`);
}

/**
 * 写入一条操作日志
 */
function writeLog(action, filePath, size) {
  try {
    const timestamp = new Date().toISOString();
    const line = `[${timestamp}] ${action} | ${filePath} | ${size} bytes\n`;
    fs.appendFileSync(getTodayLogFile(), line, 'utf-8');
  } catch {
    // 静默失败
  }
}

/**
 * 批量写入操作日志（一次打开文件写入多条，减少文件 I/O 竞争）
 * 用于批量清理场景，避免 200 并发各自 appendSync 争抢文件句柄
 * @param {Array<{ action: string, filePath: string, size: number }>} entries
 */
function writeBatchLog(entries) {
  if (!entries || entries.length === 0) return;
  try {
    const timestamp = new Date().toISOString();
    const lines = entries.map(({ action, filePath, size }) =>
      `[${timestamp}] ${action} | ${filePath} | ${size} bytes\n`
    ).join('');
    fs.appendFileSync(getTodayLogFile(), lines, 'utf-8');
  } catch {
    // 静默失败
  }
}

/**
 * 读取所有日志文件的内容
 */
function readLogs() {
  try {
    const dir = getLogsDir();
    const files = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.log'))
      .sort()
      .reverse()
      .slice(0, 10); // 最近10个日志文件

    const entries = [];
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      entries.push(...lines);
    }
    return entries.slice(-100); // 最多返回100条
  } catch {
    return [];
  }
}

module.exports = { writeLog, writeBatchLog, readLogs, getLogsDir };
