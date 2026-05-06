const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');

// 获取 ffmpeg-static 路径
let ffmpegPath;
try {
  ffmpegPath = require('ffmpeg-static');
  console.log('✅ ffmpeg-static 路径:', ffmpegPath);
  console.log('✅ 文件是否存在:', fs.existsSync(ffmpegPath));
} catch (e) {
  console.error('❌ 无法加载 ffmpeg-static:', e.message);
  process.exit(1);
}

// 设置路径
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
  console.log('✅ 已设置 ffmpeg 路径');
}

// 测试 ffmpeg 是否可用
console.log('\n🧪 测试 ffmpeg 可用性...');
ffmpeg.getAvailableFormats((err, formats) => {
  if (err) {
    console.error('❌ ffmpeg 测试失败:', err.message);
    console.error('完整错误:', err);
  } else {
    console.log('✅ ffmpeg 可用！支持的格式数量:', Object.keys(formats).length);
  }
});
