const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');

// 获取 ffmpeg-static 路径
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  console.log('原始路径:', ffmpegPath);

  // 尝试转换为 Unix 风格路径（Git Bash 兼容）
  if (process.platform === 'win32' && ffmpegPath.includes('\\')) {
    // 方案1: 转换为正斜杠
    const unixPath = ffmpegPath.replace(/\\/g, '/');
    console.log('Unix 风格路径:', unixPath);

    // 方案2: 使用 path.normalize
    const normalizedPath = path.normalize(ffmpegPath);
    console.log('Normalized 路径:', normalizedPath);

    // 方案3: 使用相对路径
    const relativePath = path.relative(process.cwd(), ffmpegPath);
    console.log('相对路径:', relativePath);
  }

  console.log('文件是否存在:', fs.existsSync(ffmpegPath));
} catch (e) {
  console.error('❌ 无法加载 ffmpeg-static:', e.message);
  process.exit(1);
}

// 测试不同路径格式
const pathsToTest = [
  ffmpegPath,
  ffmpegPath.replace(/\\/g, '/'),
  path.normalize(ffmpegPath),
];

console.log('\n🧪 测试不同路径格式...\n');

pathsToTest.forEach((testPath, index) => {
  console.log(`测试 ${index + 1}: ${testPath}`);
  ffmpeg.setFfmpegPath(testPath);

  ffmpeg.getAvailableFormats((err, formats) => {
    if (err) {
      console.error(`  ❌ 失败: ${err.message}`);
    } else {
      console.log(`  ✅ 成功！支持的格式数量: ${Object.keys(formats).length}`);
      process.exit(0);
    }
  });
});

// 超时退出
setTimeout(() => {
  console.log('\n所有路径格式都失败了');
  process.exit(1);
}, 5000);
