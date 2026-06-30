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

module.exports = { writeLog, readLogs, getLogsDir };
