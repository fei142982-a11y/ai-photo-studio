import { readFileSync } from 'fs';
import https from 'https';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { image, style, prompt } = req.body;

        if (!image || !style || !prompt) {
            return res.status(400).json({ error: '缺少必要参数' });
        }

        const apiKey = process.env.ANYCAP_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API Key 未配置' });
        }

        // 1. 上传图片到 AnyCap
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        const imageUrl = await uploadImage(imageBuffer, apiKey);

        // 2. 调用 AnyCap 图片生成 API
        const fullPrompt = `${prompt}, maintaining the same face and identity as the reference photo, high quality, 4K, professional photography`;

        const result = await callAnyCapAPI({
            prompt: fullPrompt,
            model: 'gpt-image-2',
            mode: 'image-to-image',
            images: [imageUrl]
        }, apiKey);

        if (result.status === 'success' && result.url) {
            return res.status(200).json({
                success: true,
                imageUrl: result.url,
                credits: result.credits_used
            });
        } else {
            throw new Error(result.message || '生成失败');
        }

    } catch (err) {
        console.error('生成错误:', err.message);
        return res.status(500).json({ success: false, error: err.message });
    }
}

function uploadImage(buffer, apiKey) {
    return new Promise((resolve, reject) => {
        const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
        const fileName = 'photo.png';

        const header = Buffer.from(
            `--${boundary}\r\n` +
            `Content-Disposition: form-data; name="file"; filename="${fileName}"\r\n` +
            `Content-Type: image/png\r\n\r\n`
        );
        const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
        const body = Buffer.concat([header, buffer, footer]);

        const options = {
            hostname: 'api.anycap.ai',
            path: '/v1/drive/upload',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': body.length
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.data && json.data.url) {
                        resolve(json.data.url);
                    } else if (json.url) {
                        resolve(json.url);
                    } else {
                        reject(new Error('上传失败: ' + data));
                    }
                } catch (e) {
                    reject(new Error('解析上传响应失败'));
                }
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function callAnyCapAPI(params, apiKey) {
    return new Promise((resolve, reject) => {
        const postData = JSON.stringify({
            prompt: params.prompt,
            model: params.model,
            mode: params.mode,
            params: {
                images: params.images
            }
        });

        const options = {
            hostname: 'api.anycap.ai',
            path: '/v1/image/generate',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error('解析响应失败: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}
