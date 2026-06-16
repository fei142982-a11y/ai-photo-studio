// ========== 全局变量 ==========
let uploadedFile = null;
let selectedStyle = '日系清新';
let resultImageUrl = '';
let currentUser = null;
let selectedRecharge = 'pro';

const stylePrompts = {
    '日系清新': 'Japanese style fresh portrait photo, soft natural light, cherry blossom background, warm tones, clean and minimal, professional photography, beautiful bokeh',
    '韩式证件照': 'Korean style ID photo, studio lighting, clean white background, professional headshot, soft skin, natural makeup, sharp focus',
    '复古港风': 'Hong Kong vintage style portrait, 90s film grain, moody lighting, retro color grading, cinematic, Wong Kar-wai aesthetic',
    '赛博朋克': 'Cyberpunk style portrait, neon lights, futuristic, holographic effects, purple and blue tones, sci-fi atmosphere, blade runner aesthetic',
    '国风古韵': 'Chinese traditional style portrait, hanfu clothing, ancient Chinese architecture background, ink wash painting style, elegant and graceful',
    '杂志封面': 'Fashion magazine cover portrait, high fashion, dramatic lighting, editorial photography, bold and confident, studio quality'
};

// 演示模式滤镜配置（CSS filter 语法）
const demoFilters = {
    '日系清新':   'brightness(1.15) saturate(1.1) contrast(0.9) sepia(0.1)',
    '韩式证件照': 'brightness(1.1) contrast(1.05) saturate(0.85)',
    '复古港风':   'contrast(1.2) saturate(0.7) sepia(0.4) brightness(0.95)',
    '赛博朋克':   'contrast(1.3) saturate(1.6) hue-rotate(180deg) brightness(1.05)',
    '国风古韵':   'contrast(1.1) saturate(0.8) sepia(0.25) brightness(1.05)',
    '杂志封面':   'contrast(1.15) saturate(0.9) grayscale(0.3) brightness(1.05)'
};

// 演示模式：用 Canvas 给原图加滤镜
function applyDemoFilter(base64Image, style) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.filter = demoFilters[style] || 'none';
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => resolve(base64Image); // fallback: 返回原图
        img.src = base64Image;
    });
}

// 模拟作品数据
const galleryData = [
    { style: '日系清新', author: '小樱花', emoji: '🌸' },
    { style: '韩式证件照', author: 'Minji', emoji: '💼' },
    { style: '复古港风', author: '阿飞正传', emoji: '🎞️' },
    { style: '赛博朋克', author: 'Neon_K', emoji: '🤖' },
    { style: '国风古韵', author: '长安月', emoji: '🏯' },
    { style: '杂志封面', author: 'Vogue_fan', emoji: '📰' },
    { style: '日系清新', author: '抹茶拿铁', emoji: '🌸' },
    { style: '赛博朋克', author: '2077玩家', emoji: '🤖' },
];

// ========== 初始化 ==========
document.addEventListener('DOMContentLoaded', () => {
    setupUpload();
    setupStyleCards();
    renderGallery('all');
    checkLoginStatus();
});

// ========== 上传功能 ==========
function setupUpload() {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--primary)';
    });
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.style.borderColor = 'var(--border)';
    });
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) handleFile(file);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) handleFile(e.target.files[0]);
    });
}

function handleFile(file) {
    uploadedFile = file;
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

// ========== 风格选择 ==========
function setupStyleCards() {
    document.querySelectorAll('.style-item').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.style-item').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            selectedStyle = card.dataset.style;
        });
    });
}

// ========== 生成写真 ==========
async function generate() {
    if (!uploadedFile) {
        showNotification('请先上传一张照片！', 'warning');
        return;
    }

    // 检查登录和额度
    if (!currentUser) {
        showNotification('请先登录后再生成', 'warning');
        showLoginModal();
        return;
    }
    if (currentUser.credits <= 0) {
        showNotification('额度不足，请充值后再试', 'warning');
        showRechargeModal();
        return;
    }

    const btn = document.getElementById('btnGenerate');
    const loading = document.getElementById('loading');
    const resultSection = document.getElementById('resultSection');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = '生成中...';
    loading.style.display = 'block';
    resultSection.style.display = 'none';
    loading.scrollIntoView({ behavior: 'smooth', block: 'center' });

    try {
        const base64 = await fileToBase64(uploadedFile);

        // 尝试调用后端 API，如果不可用则使用演示模式
        let data;
        try {
            const response = await fetch('/api/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64,
                    style: selectedStyle,
                    prompt: stylePrompts[selectedStyle]
                })
            });
            data = await response.json();
        } catch (apiErr) {
            // 后端不可用，使用演示模式（原图 + 风格滤镜）
            console.log('后端不可用，进入演示模式');
            const filteredImage = await applyDemoFilter(base64, selectedStyle);
            data = {
                success: true,
                imageUrl: filteredImage,
                demo: true
            };
        }

        if (data.success) {
            resultImageUrl = data.imageUrl;
            document.getElementById('resultImg').src = data.imageUrl;
            document.getElementById('resultStyle').textContent = selectedStyle + (data.demo ? '（演示模式）' : '');
            resultSection.style.display = 'block';

            // 扣除额度
            currentUser.credits -= 1;
            updateCreditsDisplay();
            saveUserToStorage();

            // 保存历史记录
            saveHistory(selectedStyle, data.imageUrl);

            setTimeout(() => resultSection.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
            showNotification('写真生成成功！', 'success');
        } else {
            throw new Error(data.error || '生成失败');
        }
    } catch (err) {
        showNotification('生成失败：' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = '生成我的写真';
        loading.style.display = 'none';
    }
}

function download() {
    if (!resultImageUrl) return;
    const a = document.createElement('a');
    a.href = resultImageUrl;
    a.download = `ai-photo-${selectedStyle}-${Date.now()}.png`;
    a.click();
    showNotification('图片已开始下载', 'success');
}

// ========== 用户系统 ==========
function checkLoginStatus() {
    const saved = localStorage.getItem('ai_photo_user');
    if (saved) {
        currentUser = JSON.parse(saved);
        updateUIAfterLogin();
    }
}

function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
}

function closeLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
}

function switchTab(tab) {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    if (tab === 'login') {
        document.querySelectorAll('.modal-tab')[0].classList.add('active');
        document.getElementById('loginForm').style.display = 'block';
        document.getElementById('registerForm').style.display = 'none';
    } else {
        document.querySelectorAll('.modal-tab')[1].classList.add('active');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('registerForm').style.display = 'block';
    }
}

function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    // 检查是否已注册
    const users = JSON.parse(localStorage.getItem('ai_photo_users') || '{}');
    if (users[email]) {
        showNotification('该邮箱已注册，请直接登录', 'warning');
        switchTab('login');
        return;
    }

    // 注册新用户
    users[email] = { name, email, password, credits: 5 };
    localStorage.setItem('ai_photo_users', JSON.stringify(users));

    // 自动登录
    currentUser = { name, email, credits: 5 };
    localStorage.setItem('ai_photo_user', JSON.stringify(currentUser));
    updateUIAfterLogin();
    closeLoginModal();
    showNotification(`注册成功！已赠送 5 次免费额度`, 'success');
}

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const users = JSON.parse(localStorage.getItem('ai_photo_users') || '{}');
    const user = users[email];

    if (!user || user.password !== password) {
        showNotification('邮箱或密码错误', 'error');
        return;
    }

    currentUser = { name: user.name, email: user.email, credits: user.credits };
    localStorage.setItem('ai_photo_user', JSON.stringify(currentUser));
    updateUIAfterLogin();
    closeLoginModal();
    showNotification(`欢迎回来，${user.name}！`, 'success');
}

function logout() {
    currentUser = null;
    localStorage.removeItem('ai_photo_user');
    document.getElementById('btnLoginNav').style.display = 'block';
    document.getElementById('userMenu').style.display = 'none';
    document.getElementById('creditsBadge').style.display = 'none';
    closeUserDropdown();
    showNotification('已退出登录', 'info');
}

function updateUIAfterLogin() {
    document.getElementById('btnLoginNav').style.display = 'none';
    document.getElementById('userMenu').style.display = 'block';
    document.getElementById('creditsBadge').style.display = 'inline-flex';
    document.getElementById('dropdownName').textContent = currentUser.name;
    document.getElementById('dropdownEmail').textContent = currentUser.email;
    updateCreditsDisplay();
}

function updateCreditsDisplay() {
    document.getElementById('credits').textContent = currentUser.credits;
}

function toggleUserDropdown() {
    document.getElementById('userDropdown').classList.toggle('show');
}

function closeUserDropdown() {
    document.getElementById('userDropdown').classList.remove('show');
}

// 点击外部关闭下拉菜单
document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) closeUserDropdown();
});

function saveUserToStorage() {
    localStorage.setItem('ai_photo_user', JSON.stringify(currentUser));
    // 同步到用户列表
    const users = JSON.parse(localStorage.getItem('ai_photo_users') || '{}');
    if (users[currentUser.email]) {
        users[currentUser.email].credits = currentUser.credits;
        localStorage.setItem('ai_photo_users', JSON.stringify(users));
    }
}

// ========== 充值系统 ==========
const PLANS = {
    'standard':  { credits: 50,   price: 9.9,  name: '标准套餐' },
    'pro':       { credits: 200,  price: 29.9, name: '专业套餐' },
    'enterprise':{ credits: 1000, price: 99,   name: '企业套餐' }
};

function showRechargeModal() {
    updatePaymentInfo();
    document.getElementById('rechargeModal').style.display = 'flex';
}

function closeRechargeModal() {
    document.getElementById('rechargeModal').style.display = 'none';
}

function selectRecharge(plan) {
    selectedRecharge = plan;
    document.querySelectorAll('.recharge-item').forEach(item => item.classList.remove('selected'));
    event.currentTarget.classList.add('selected');
    updatePaymentInfo();
}

function updatePaymentInfo() {
    const plan = PLANS[selectedRecharge];
    if (!plan) return;
    document.getElementById('payPlan').textContent = plan.name;
    document.getElementById('payCredits').textContent = `${plan.credits} 次`;
    document.getElementById('payPrice').textContent = `¥${plan.price}`;
}

function recharge(plan) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    selectedRecharge = plan;
    showRechargeModal();
}

function confirmPaid() {
    showNotification('已收到付款确认请求，请等待管理员审核', 'info');
    closeRechargeModal();
}

// 演示模式：模拟付款成功
function simulatePay() {
    const plan = PLANS[selectedRecharge];
    currentUser.credits += plan.credits;
    saveUserToStorage();
    updateCreditsDisplay();
    closeRechargeModal();
    showNotification(`模拟付款成功！已到账 ${plan.credits} 次额度`, 'success');
}

// ========== 历史记录 ==========
function saveHistory(style, imageUrl) {
    const history = JSON.parse(localStorage.getItem('ai_photo_history') || '[]');
    history.unshift({
        style,
        imageUrl,
        time: new Date().toLocaleString('zh-CN'),
        id: Date.now()
    });
    if (history.length > 20) history.pop();
    localStorage.setItem('ai_photo_history', JSON.stringify(history));
}

function showHistory() {
    closeUserDropdown();
    const history = JSON.parse(localStorage.getItem('ai_photo_history') || '[]');
    const list = document.getElementById('historyList');

    if (history.length === 0) {
        list.innerHTML = '<div class="history-empty">暂无记录，快去生成你的第一张写真吧！</div>';
    } else {
        list.innerHTML = history.map(item => `
            <div class="history-item">
                <img src="${item.imageUrl}" alt="${item.style}">
                <div class="history-info">
                    <strong>${item.style}</strong>
                    <span>${item.time}</span>
                </div>
            </div>
        `).join('');
    }
    document.getElementById('historyModal').style.display = 'flex';
}

function closeHistoryModal() {
    document.getElementById('historyModal').style.display = 'none';
}

// ========== 作品墙 ==========
function renderGallery(filter) {
    const grid = document.getElementById('galleryGrid');
    const colors = [
        'linear-gradient(135deg, #ffecd2, #fcb69f)',
        'linear-gradient(135deg, #a1c4fd, #c2e9fb)',
        'linear-gradient(135deg, #667eea, #764ba2)',
        'linear-gradient(135deg, #0f0c29, #302b63)',
        'linear-gradient(135deg, #ffecd2, #d4a574)',
        'linear-gradient(135deg, #434343, #000000)'
    ];
    const styleIndex = { '日系清新': 0, '韩式证件照': 1, '复古港风': 2, '赛博朋克': 3, '国风古韵': 4, '杂志封面': 5 };

    const items = filter === 'all' ? galleryData : galleryData.filter(d => d.style === filter);

    grid.innerHTML = items.map((item, i) => `
        <div class="gallery-item" style="background: ${colors[(styleIndex[item.style] || 0) % colors.length]}; display: flex; align-items: center; justify-content: center; font-size: 4rem;">
            ${item.emoji}
            <div class="gallery-overlay">
                <div class="gallery-style">${item.style}</div>
                <div class="gallery-author">by ${item.author}</div>
            </div>
        </div>
    `).join('');
}

function filterGallery(style) {
    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderGallery(style);
}

// ========== 通知系统 ==========
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = { success: '#22c55e', warning: '#f59e0b', error: '#ef4444', info: '#6366f1' };
    const icons = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };

    notification.style.cssText = `
        position: fixed; top: 24px; right: 24px; background: ${colors[type]};
        color: white; padding: 14px 24px; border-radius: 12px;
        display: flex; align-items: center; gap: 10px; font-size: 0.95rem;
        z-index: 1000; animation: slideIn 0.3s ease;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    `;
    notification.innerHTML = `<span>${icons[type]}</span><span>${message}</span>`;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ========== 工具函数 ==========
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// 动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(style);
