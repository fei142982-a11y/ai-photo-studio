// 全局变量
let uploadedFile = null;
let selectedStyle = '日系清新';
let resultImageUrl = '';

// 风格对应的提示词
const stylePrompts = {
    '日系清新': 'Japanese style fresh portrait photo, soft natural light, cherry blossom background, warm tones, clean and minimal, professional photography, beautiful bokeh, gentle smile',
    '韩式证件照': 'Korean style ID photo, studio lighting, clean white background, professional headshot, soft skin, natural makeup, sharp focus, confident expression',
    '复古港风': 'Hong Kong vintage style portrait, 90s film grain, moody lighting, retro color grading, cinematic, Wong Kar-wai aesthetic, nostalgic mood',
    '赛博朋克': 'Cyberpunk style portrait, neon lights, futuristic, holographic effects, purple and blue tones, sci-fi atmosphere, blade runner aesthetic, glowing accents',
    '国风古韵': 'Chinese traditional style portrait, hanfu clothing, ancient Chinese architecture background, ink wash painting style, elegant and graceful, ethereal beauty',
    '杂志封面': 'Fashion magazine cover portrait, high fashion, dramatic lighting, editorial photography, bold and confident, studio quality, sharp contrast'
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupUpload();
    setupStyleCards();
    addScrollAnimations();
});

// 上传功能
function setupUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary)';
        uploadArea.style.background = 'rgba(99, 102, 241, 0.05)';
    });

    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'var(--border)';
        uploadArea.style.background = 'transparent';
    });

    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border)';
        uploadArea.style.background = 'transparent';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            handleFile(file);
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
    });
}

function handleFile(file) {
    uploadedFile = file;

    // 显示文件信息
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileSize').textContent = formatFileSize(file.size);

    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('previewImg').src = e.target.result;
        document.getElementById('uploadContent').style.display = 'none';
        document.getElementById('previewArea').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

function removeImage() {
    uploadedFile = null;
    document.getElementById('uploadContent').style.display = 'block';
    document.getElementById('previewArea').style.display = 'none';
    document.getElementById('fileInput').value = '';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 风格选择
function setupStyleCards() {
    const cards = document.querySelectorAll('.style-item');
    cards.forEach(card => {
        card.addEventListener('click', () => {
            cards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedStyle = card.dataset.style;
        });
    });
}

// 生成写真
async function generate() {
    if (!uploadedFile) {
        showNotification('请先上传一张照片！', 'warning');
        return;
    }

    const btn = document.getElementById('btnGenerate');
    const loading = document.getElementById('loading');
    const resultSection = document.getElementById('resultSection');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = '生成中...';
    loading.style.display = 'block';
    resultSection.style.display = 'none';

    // 滚动到加载区域
    loading.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        // 将图片转为 base64
        const base64 = await fileToBase64(uploadedFile);

        // 调用后端 API
        const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                image: base64,
                style: selectedStyle,
                prompt: stylePrompts[selectedStyle]
            })
        });

        const data = await response.json();

        if (data.success) {
            resultImageUrl = data.imageUrl;
            document.getElementById('resultImg').src = data.imageUrl;
            document.getElementById('resultStyle').textContent = selectedStyle;
            resultSection.style.display = 'block';
            loading.style.display = 'none';

            // 更新额度
            const creditsEl = document.getElementById('credits');
            const current = parseInt(creditsEl.textContent);
            creditsEl.textContent = Math.max(0, current - 1);

            // 滚动到结果
            setTimeout(() => {
                resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);

            showNotification('写真生成成功！', 'success');
        } else {
            throw new Error(data.error || '生成失败');
        }
    } catch (err) {
        showNotification('生成失败：' + err.message, 'error');
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = '生成我的写真';
        loading.style.display = 'none';
    }
}

// 下载图片
function download() {
    if (!resultImageUrl) return;
    const a = document.createElement('a');
    a.href = resultImageUrl;
    a.download = `ai-photo-${selectedStyle}-${Date.now()}.png`;
    a.click();
    showNotification('图片已开始下载', 'success');
}

// 通知系统
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span>${type === 'success' ? '✓' : type === 'warning' ? '⚠' : '✕'}</span>
        <span>${message}</span>
    `;

    // 添加样式
    notification.style.cssText = `
        position: fixed;
        top: 24px;
        right: 24px;
        background: ${type === 'success' ? '#22c55e' : type === 'warning' ? '#f59e0b' : '#ef4444'};
        color: white;
        padding: 14px 24px;
        border-radius: 12px;
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.95rem;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 工具函数
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 滚动动画
function addScrollAnimations() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}
