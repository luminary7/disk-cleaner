/**
 * 简单的 JSON 文件存储，用于持久化设置和 AI 配置
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const STORE_FILE = 'config.json';

class Store {
  constructor() {
    const userDataPath = app.getPath('userData');
    this.filePath = path.join(userDataPath, STORE_FILE);
    this.data = {};
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch {
      this.data = {};
    }
  }

  _save() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[Store] 写入配置文件失败:', err.message);
    }
  }

  get(key, defaultValue = null) {
    return this.data[key] !== undefined ? this.data[key] : defaultValue;
  }

  set(key, value) {
    this.data[key] = value;
    this._save();
  }

  getAll() {
    return { ...this.data };
  }
}

module.exports = Store;
