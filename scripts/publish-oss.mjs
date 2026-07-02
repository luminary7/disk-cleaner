/**
 * 一键构建并上传到阿里云 OSS
 *
 * 用法：
 *   1. 安装依赖：npm install -D ali-oss
 *   2. 在项目根目录创建 .env.oss：
 *        OSS_REGION=oss-cn-hangzhou
 *        OSS_BUCKET=my-bucket
 *        OSS_ACCESS_KEY_ID=xxx
 *        OSS_ACCESS_KEY_SECRET=xxx
 *   3. node scripts/publish-oss.mjs
 */
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const releaseDir = path.join(root, 'release');

// 1. 读取当前版本号
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
const version = pkg.version;
console.log(`📦 当前版本: v${version}`);

// 2. 构建
console.log('🔨 正在构建...');
execSync('npm run electron:build', { cwd: root, stdio: 'inherit' });

// 3. 找到构建产物
const files = fs.readdirSync(releaseDir).filter(f =>
  f === 'latest.yml' || f.endsWith('.exe') || f.endsWith('.exe.blockmap')
);

if (files.length === 0) {
  console.error('❌ 未找到构建产物');
  process.exit(1);
}

console.log(`📎 待上传文件:\n  ${files.join('\n  ')}`);

// 4. 上传到 OSS
const OSS = (await import('ali-oss')).default;
const client = new OSS({
  region: process.env.OSS_REGION,
  bucket: process.env.OSS_BUCKET,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
});

const prefix = `releases/`;

for (const file of files) {
  const filePath = path.join(releaseDir, file);
  console.log(`⬆️  上传 ${file}...`);
  await client.put(`${prefix}${file}`, filePath);
  console.log(`✅ ${file} 上传完成`);
}

console.log(`\n🎉 发布完成!
更新地址: https://${process.env.OSS_BUCKET}.${process.env.OSS_REGION}.aliyuncs.com/${prefix}
请在应用关于页配置此地址`);
