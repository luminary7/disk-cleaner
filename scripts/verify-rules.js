const ruleEngine = require('../electron/rule-engine');

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const old = Date.now() - 10 * DAY;
const recent = Date.now() - 2 * HOUR;

const samples = [
  {
    name: 'protected system dll',
    path: 'C:\\Windows\\System32\\kernel32.dll',
    category: 'system',
    size: 1024 * 1024,
    mtimeMs: old,
    expected: 'keep',
  },
  {
    name: 'old temp file',
    path: 'C:\\Users\\u\\AppData\\Local\\Temp\\old.tmp',
    category: 'temp',
    size: 1024 * 1024,
    mtimeMs: old,
    expected: 'safe',
  },
  {
    name: 'recent temp file',
    path: 'C:\\Users\\u\\AppData\\Local\\Temp\\recent.tmp',
    category: 'temp',
    size: 1024 * 1024,
    mtimeMs: recent,
    expected: 'caution',
  },
  {
    name: 'unknown temp extension needs confirmation',
    path: 'C:\\Users\\u\\AppData\\Local\\Temp\\session.lock',
    category: 'temp',
    size: 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'wechat user document',
    path: 'C:\\Users\\u\\Documents\\WeChat Files\\user\\FileStorage\\File\\2026-06\\contract.pdf',
    category: 'app',
    size: 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'qq user image',
    path: 'C:\\Users\\u\\Documents\\Tencent Files\\123\\Image\\photo.jpg',
    category: 'app',
    size: 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'known app cache',
    path: 'C:\\Users\\u\\AppData\\Roaming\\Tencent\\WeChat\\Cache\\old.log',
    category: 'app',
    size: 1024 * 1024,
    mtimeMs: old,
    expected: 'safe',
  },
  {
    name: 'archive in downloads',
    path: 'C:\\Users\\u\\Downloads\\installer.zip',
    category: 'large-file',
    size: 200 * 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'game resource',
    path: 'D:\\Games\\Steam\\steamapps\\common\\Game\\big.pak',
    category: 'large-file',
    size: 2 * 1024 * 1024 * 1024,
    mtimeMs: old,
    expected: 'keep',
  },
  {
    name: 'unknown file in game folder',
    path: 'D:\\Games\\Steam\\steamapps\\common\\Game\\asset.bundle',
    category: 'large-file',
    size: 500 * 1024 * 1024,
    mtimeMs: old,
    expected: 'keep',
  },
  {
    name: 'comfyui model checkpoint',
    path: 'C:\\software\\comfyUI\\models\\checkpoints\\model.safetensors',
    category: 'large-file',
    size: 4 * 1024 * 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'unknown large file',
    path: 'D:\\Downloads\\dataset.partfile',
    category: 'large-file',
    size: 200 * 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'structural database',
    path: 'C:\\Users\\u\\AppData\\Roaming\\ImportantApp\\profile.sqlite',
    category: 'large-file',
    size: 200 * 1024 * 1024,
    mtimeMs: old,
    expected: 'keep',
  },
  {
    name: 'secret key file',
    path: 'D:\\Backup\\server.pem',
    category: 'large-file',
    size: 100 * 1024 * 1024,
    mtimeMs: old,
    expected: 'keep',
  },
  {
    name: 'video file',
    path: 'D:\\Movies\\movie.mkv',
    category: 'large-file',
    size: 2 * 1024 * 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
  {
    name: 'virtual disk',
    path: 'D:\\VMs\\ubuntu.vhdx',
    category: 'large-file',
    size: 10 * 1024 * 1024 * 1024,
    mtimeMs: old,
    expected: 'keep',
  },
  {
    name: 'no extension',
    path: 'D:\\Downloads\\largefile',
    category: 'large-file',
    size: 100 * 1024 * 1024,
    mtimeMs: old,
    expected: 'caution',
  },
];

let failures = 0;

for (const sample of samples) {
  const actual = ruleEngine.evaluate(sample.path, sample.size, sample.category, { mtimeMs: sample.mtimeMs });
  if (actual !== sample.expected) {
    failures++;
    console.error(`[FAIL] ${sample.name}: expected ${sample.expected}, got ${actual}`);
    console.error(`       ${sample.path}`);
  } else {
    console.log(`[PASS] ${sample.name}: ${actual}`);
  }
}

if (failures > 0) {
  console.error(`Rule verification failed: ${failures} sample(s) did not match policy.`);
  process.exit(1);
}

console.log(`Rule verification passed: ${samples.length} samples.`);
