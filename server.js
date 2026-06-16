const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = 3000;

// MIME 类型
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.json': 'application/json'
};

// 创建服务器
const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // API: 生成写真
    if (req.method === 'POST' && req.url === '/api/generate') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
            try {
                const { image, style, prompt } = JSON.parse(body);

                // 保存上传的图片
                const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
                const inputPath = path.join(__dirname, 'temp_input.png');
                fs.writeFileSync(inputPath, Buffer.from(base64Data, 'base64'));

                // 输出路径
                const outputName = `result_${Date.now()}.png`;
                const outputPath = path.join(__dirname, 'outputs', outputName);

                // 确保 outputs 目录存在
                if (!fs.existsSync(path.join(__dirname, 'outputs'))) {
                    fs.mkdirSync(path.join(__dirname, 'outputs'));
                }

                // 调用 AnyCap 生成图片
                const fullPrompt = `${prompt}, maintaining the same face and identity as the reference photo, high quality, 4K, professional photography`;
                const cmd = `anycap image generate --prompt "${fullPrompt}" --model gpt-image-2 --mode image-to-image --param images="${inputPath}" -o "${outputPath}"`;

                console.log(`[${style}] 开始生成...`);
                const result = execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
                const resultData = JSON.parse(result);

                if (resultData.status === 'success') {
                    // 读取生成的图片并转为 base64
                    const imgBuffer = fs.readFileSync(outputPath);
                    const imgBase64 = `data:image/png;base64,${imgBuffer.toString('base64')}`;

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        imageUrl: imgBase64,
                        credits: resultData.credits_used
                    }));

                    console.log(`[${style}] 生成成功！花费 ${resultData.credits_used} credits`);
                } else {
                    throw new Error(resultData.message || '生成失败');
                }

                // 清理临时文件
                try { fs.unlinkSync(inputPath); } catch(e) {}

            } catch (err) {
                console.error('生成错误:', err.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // 静态文件服务
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const content = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (err) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`\n✨ AI 写真馆已启动！`);
    console.log(`🌐 打开浏览器访问: http://localhost:${PORT}`);
    console.log(`\n按 Ctrl+C 停止服务\n`);
});
