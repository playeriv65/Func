const API_BASE = '';
let currentTaskId = null;
let pollingInterval = null;
let currentTheme = 'auto';
let isComplexMode = false;

// Initialize
if (typeof lucide !== 'undefined') lucide.createIcons();
initTheme();
loadInputFiles();
loadOutputFiles();

// Mode switching
function toggleMode() {
    isComplexMode = !isComplexMode;

    const modeSwitch = document.getElementById('modeSwitch');
    const modeToggle = document.getElementById('modeToggle');
    const modeToggleDot = document.getElementById('modeToggleDot');
    const centerPanel = document.getElementById('centerPanel');
    const simplePanel = document.getElementById('simplePanel');
    const chatMessages = document.getElementById('chatMessages');
    const chatInputContainer = document.getElementById('chatInputContainer');

    if (isComplexMode) {
        modeSwitch.classList.add('active');
        modeToggle.classList.add('bg-blue-500');
        modeToggle.classList.remove('bg-gray-400', 'dark:bg-gray-600');
        modeToggleDot.classList.add('translate-x-4');

        simplePanel.classList.add('hidden');
        chatMessages.classList.remove('hidden');
        chatMessages.classList.add('flex');
        chatInputContainer.classList.remove('hidden');
        chatInputContainer.classList.add('block');

        document.getElementById('chatInstruction').focus();
    } else {
        modeSwitch.classList.remove('active');
        modeToggle.classList.remove('bg-blue-500');
        modeToggle.classList.add('bg-gray-400', 'dark:bg-gray-600');
        modeToggleDot.classList.remove('translate-x-4');

        simplePanel.classList.remove('hidden');
        chatMessages.classList.add('hidden');
        chatMessages.classList.remove('flex');
        chatInputContainer.classList.add('hidden');
        chatInputContainer.classList.remove('block');

        document.getElementById('instruction').focus();
    }
}

// Theme management
function initTheme() {
    const saved = localStorage.getItem('theme');
    currentTheme = saved || 'auto';
    applyTheme();
}

function applyTheme() {
    const html = document.documentElement;
    const themeText = document.getElementById('themeText');

    html.removeAttribute('data-theme');
    html.classList.remove('dark');

    if (currentTheme === 'light') {
        html.setAttribute('data-theme', 'light');
        themeText.textContent = '浅色';
    } else if (currentTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        html.classList.add('dark');
        themeText.textContent = '深色';
    } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
            html.classList.add('dark');
        }
        themeText.textContent = '自动';
    }

    if (typeof lucide !== 'undefined') lucide.createIcons();
}

function toggleTheme() {
    const themes = ['auto', 'light', 'dark'];
    const currentIndex = themes.indexOf(currentTheme);
    currentTheme = themes[(currentIndex + 1) % themes.length];
    localStorage.setItem('theme', currentTheme);
    applyTheme();
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (currentTheme === 'auto') applyTheme();
});

// Upload handling
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/10');
    uploadZone.classList.remove('border-gray-300', 'dark:border-gray-700', 'bg-gray-50', 'dark:bg-gray-900');
});
uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/10');
    uploadZone.classList.add('border-gray-300', 'dark:border-gray-700', 'bg-gray-50', 'dark:bg-gray-900');
});
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('border-blue-500', 'bg-blue-50', 'dark:bg-blue-900/10');
    uploadZone.classList.add('border-gray-300', 'dark:border-gray-700', 'bg-gray-50', 'dark:bg-gray-900');
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

async function handleFiles(files) {
    for (const file of files) await uploadFile(file);
    await loadInputFiles();
    if (files.length > 0) showToast('success', `已上传 ${files.length} 个文件`);
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch(`${API_BASE}/api/files/upload`, { method: 'POST', body: formData });
        return response.ok;
    } catch (error) {
        console.error('Upload error:', error);
        return false;
    }
}

async function loadInputFiles() {
    try {
        const response = await fetch(`${API_BASE}/api/files/input`);
        const data = await response.json();
        const fileList = document.getElementById('inputFileList');
        const fileCount = document.getElementById('fileCount');

        fileCount.textContent = data.files.length;

        if (data.files.length === 0) {
            fileList.innerHTML = `
                <div class="text-center text-gray-400 dark:text-gray-500 py-8">
                    <div class="text-sm">暂无输入文件</div>
                </div>`;
            return;
        }

        fileList.innerHTML = '';
        data.files.forEach(filename => {
            const item = document.createElement('div');
            item.className = 'flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-sm transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600';
            item.innerHTML = `
                <svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="flex-1 break-all text-gray-700 dark:text-gray-300 font-medium text-xs">${escapeHtml(filename)}</span>
                <button onclick="deleteInputFile('${escapeHtml(filename)}')" class="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-400 hover:text-red-500 transition-colors duration-150" title="删除">
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            `;
            fileList.appendChild(item);
        });
    } catch (error) {
        console.error('Error loading input files:', error);
    }
}

async function deleteInputFile(filename) {
    try {
        const response = await fetch(`${API_BASE}/api/files/input/${filename}`, { method: 'DELETE' });
        if (response.ok) {
            await loadInputFiles();
            showToast('success', `已删除：${filename}`);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

async function deleteOutputFile(filename) {
    if (!confirm(`确定要删除 ${filename} 吗？`)) return;

    try {
        const response = await fetch(`${API_BASE}/api/files/output/${filename}`, { method: 'DELETE' });
        if (response.ok) {
            await loadOutputFiles();
            showToast('success', `已删除：${filename}`);
        }
    } catch (error) {
        console.error('Error deleting file:', error);
    }
}

// Toast notification
function showToast(type, message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = document.getElementById('toastIcon');

    if (type === 'success') {
        toastIcon.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
        toast.classList.remove('border-red-300', 'dark:border-red-700', 'bg-red-50', 'dark:bg-red-900/10');
        toast.classList.add('border-green-300', 'dark:border-green-700', 'bg-green-50', 'dark:bg-green-900/10');
        toastIcon.classList.add('text-green-600', 'dark:text-green-400');
        toastIcon.classList.remove('text-red-600', 'dark:text-red-400');
    } else {
        toastIcon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
        toast.classList.remove('border-green-300', 'dark:border-green-700', 'bg-green-50', 'dark:bg-green-900/10');
        toast.classList.add('border-red-300', 'dark:border-red-700', 'bg-red-50', 'dark:bg-red-900/10');
        toastIcon.classList.add('text-red-600', 'dark:text-red-400');
        toastIcon.classList.remove('text-green-600', 'dark:text-green-400');
    }

    toastMessage.textContent = message;
    toast.classList.remove('opacity-0', 'pointer-events-none');
    toast.classList.add('toast-enter');

    setTimeout(() => {
        toast.classList.add('opacity-0', 'pointer-events-none');
        toast.classList.remove('toast-enter');
    }, 3000);
}

// Execute task (simple mode)
async function executeTask() {
    const instruction = document.getElementById('instruction').value.trim();
    if (!instruction) { showToast('error', '请输入指令'); return; }

    const runBtn = document.getElementById('runBtn');

    runBtn.disabled = true;
    runBtn.classList.add('bg-amber-500', 'animate-pulse-slow');
    runBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');

    try {
        const response = await fetch(`${API_BASE}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction })
        });

        const data = await response.json();

        if (response.ok) {
            currentTaskId = data.task_id;
            updateStatus('running', '执行中');
            startPolling();
        } else {
            showToast('error', data.error || '执行失败');
            resetRunBtn();
        }
    } catch (error) {
        showToast('error', error.message);
        resetRunBtn();
    }
}

function resetRunBtn() {
    const runBtn = document.getElementById('runBtn');
    runBtn.disabled = false;
    runBtn.classList.remove('bg-amber-500', 'animate-pulse-slow');
    runBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
}

// Execute task (complex mode)
async function executeTaskComplex() {
    const instruction = document.getElementById('chatInstruction').value.trim();
    if (!instruction) { addAIMessage('请输入指令'); return; }

    const sendBtn = document.getElementById('sendBtn');
    const input = document.getElementById('chatInstruction');

    sendBtn.disabled = true;
    addUserMessage(instruction);
    input.value = '';
    input.style.height = 'auto';

    const aiMessageId = addAIThinkingMessage();

    try {
        const response = await fetch(`${API_BASE}/api/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ instruction })
        });

        const data = await response.json();

        if (response.ok) {
            currentTaskId = data.task_id;
            updateStatus('running', '执行中');
            updateMessage(aiMessageId, 'task_started');
            startPollingComplex(aiMessageId);
        } else {
            updateMessage(aiMessageId, 'error', data.error || '执行失败');
            sendBtn.disabled = false;
        }
    } catch (error) {
        updateMessage(aiMessageId, 'error', error.message);
        sendBtn.disabled = false;
    }
}

function startPolling() {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        if (!currentTaskId) return;

        try {
            const response = await fetch(`${API_BASE}/api/task/${currentTaskId}`);
            const data = await response.json();

            if (data.status === 'completed') {
                clearInterval(pollingInterval);
                updateStatus('ready', '就绪');
                showToast('success', '任务完成！');
                await loadOutputFiles();
                resetRunBtn();
            } else if (data.status === 'failed' || data.status === 'timeout') {
                clearInterval(pollingInterval);
                updateStatus('ready', '就绪');
                showToast('error', `任务失败：${data.status}`);
                resetRunBtn();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

function startPollingComplex(aiMessageId) {
    if (pollingInterval) clearInterval(pollingInterval);

    pollingInterval = setInterval(async () => {
        if (!currentTaskId) return;

        try {
            const response = await fetch(`${API_BASE}/api/task/${currentTaskId}`);
            const data = await response.json();

            updateChatStatus(data, aiMessageId);

            if (data.finished) {
                clearInterval(pollingInterval);
                document.getElementById('sendBtn').disabled = false;
                await loadOutputFiles();
            }
        } catch (error) {
            console.error('Polling error:', error);
        }
    }, 2000);
}

function updateChatStatus(data, aiMessageId) {
    if (data.status === 'running') {
        updateMessage(aiMessageId, 'running', data);
    } else if (data.status === 'completed') {
        updateStatus('ready', '就绪');
        updateMessage(aiMessageId, 'completed', data);
        addSystemMessage('任务完成');
    } else if (data.status === 'failed' || data.status === 'timeout') {
        updateStatus('ready', '就绪');
        updateMessage(aiMessageId, 'failed', data);
    }
}

function updateStatus(status, text) {
    const dot = document.getElementById('statusDot');
    const textEl = document.getElementById('statusText');

    if (status === 'running') {
        dot.classList.add('bg-amber-500', 'animate-pulse-slow');
        dot.classList.remove('bg-green-500');
        textEl.textContent = text;
    } else {
        dot.classList.remove('bg-amber-500', 'animate-pulse-slow');
        dot.classList.add('bg-green-500');
        textEl.textContent = text;
    }
}

async function loadOutputFiles() {
    try {
        const response = await fetch(`${API_BASE}/api/files/output`);
        const data = await response.json();
        const fileList = document.getElementById('outputFileList');
        const outputCount = document.getElementById('outputCount');

        outputCount.textContent = data.files ? data.files.length : 0;

        if (data.files && data.files.length > 0) {
            fileList.innerHTML = '';
            data.files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg transition-all duration-150 hover:bg-gray-100 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600';
                const fileName = typeof file === 'string' ? file : file.name;
                const fileSize = typeof file === 'object' && file.size ? file.size : 0;
                const fileMod = typeof file === 'object' && file.modified ? file.modified : Date.now();
                item.innerHTML = `
                    <div class="font-semibold break-all mb-1 text-xs text-gray-800 dark:text-gray-200">${escapeHtml(fileName)}</div>
                    <div class="text-xs text-gray-400 dark:text-gray-500 mb-2">大小：${formatFileSize(fileSize)} · 修改时间：${new Date(fileMod).toLocaleString('zh-CN')}</div>
                    <div class="flex gap-1.5">
                        <a href="${API_BASE}/api/files/download/${encodeURIComponent(fileName)}" class="flex-1 px-2 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded-md flex items-center justify-center transition-colors duration-150">下载</a>
                        <button onclick="deleteOutputFile('${escapeHtml(fileName)}')" class="p-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-gray-400 hover:text-red-500 hover:border-red-300 dark:hover:border-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-150" title="删除">
                            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"/>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                            </svg>
                        </button>
                    </div>
                `;
                fileList.appendChild(item);
            });
        } else {
            fileList.innerHTML = `
                <div class="text-center text-gray-400 dark:text-gray-500 py-8">
                    <svg class="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-gray-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <div class="text-sm">暂无输出文件</div>
                </div>`;
        }
    } catch (error) {
        console.error('Error loading output files:', error);
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// Auto-resize textarea
const textarea = document.getElementById('instruction');
if (textarea) {
    textarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 300) + 'px';
    });

    textarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeTask();
        }
    });
}

// Complex mode - auto-resize chat input
const chatTextarea = document.getElementById('chatInstruction');
if (chatTextarea) {
    chatTextarea.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 200) + 'px';
    });

    chatTextarea.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            executeTaskComplex();
        }
    });
}

// Complex mode message functions
function addAIMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex flex-col gap-1 items-start animate-fade-in';
    messageDiv.innerHTML = `
        <div class="max-w-full">
            <div class="text-sm leading-relaxed text-gray-800 dark:text-gray-200">${escapeHtml(content)}</div>
        </div>
        <div class="text-xs text-gray-400 dark:text-gray-500">刚刚</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex flex-col gap-1 items-end animate-fade-in';
    messageDiv.innerHTML = `
        <div class="max-w-full">
            <div class="bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-4 py-3 rounded-xl rounded-br-md text-sm leading-relaxed text-gray-800 dark:text-gray-200 shadow-sm">${escapeHtml(content)}</div>
        </div>
        <div class="text-xs text-gray-400 dark:text-gray-500">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'text-center my-2 animate-fade-in';
    messageDiv.innerHTML = `
        <span class="inline-block bg-gray-100 dark:bg-gray-800 px-3 py-1.5 rounded-full text-xs text-gray-500 dark:text-gray-400">${escapeHtml(content)}</span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAIThinkingMessage() {
    const chatMessages = document.getElementById('chatMessages');
    const messageId = 'msg-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'flex flex-col gap-1 items-start animate-fade-in';
    messageDiv.id = messageId;
    messageDiv.innerHTML = `
        <div class="max-w-full">
            <div class="text-sm text-gray-500 dark:text-gray-400">
                <div class="flex items-center gap-2">
                    <svg class="w-3.5 h-3.5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    <span>思考中...</span>
                </div>
            </div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return messageId;
}

function updateMessage(messageId, type, data = null) {
    const messageDiv = document.getElementById(messageId);
    if (!messageDiv) return;

    if (type === 'task_started') {
        messageDiv.innerHTML = `
            <div class="max-w-full">
                <div class="text-sm leading-relaxed text-gray-800 dark:text-gray-200">收到指令，开始执行任务...</div>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
    } else if (type === 'running' && data) {
        const cleanedOutput = data.stdout ? cleanGooseOutput(data.stdout) : '';
        messageDiv.innerHTML = `
            <div class="max-w-full w-full">
                <div class="text-sm leading-relaxed text-gray-800 dark:text-gray-200 w-full">
                    ${cleanedOutput ? createToolCall('执行中', '正在处理任务', cleanedOutput, true) : ''}
                    <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-3">
                        <svg class="w-3.5 h-3.5 animate-spin-slow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        <span>正在处理，请稍候...</span>
                    </div>
                </div>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
    } else if (type === 'completed' && data) {
        let contentHtml = '';

        if (data.stdout) {
            const cleaned = cleanGooseOutput(data.stdout);
            contentHtml += `<div class="markdown-body">${renderMarkdown(cleaned)}</div>`;
        }

        if (data.output_files && data.output_files.length > 0) {
            contentHtml += `
                <div class="mt-4 p-3 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg">
                    <div class="flex items-center gap-1.5 text-green-600 dark:text-green-400 font-semibold mb-2 text-sm">
                        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        生成文件
                    </div>
                    <div class="ml-2 space-y-1">
                        ${data.output_files.map(f => `
                            <div class="flex items-center gap-1.5 font-mono text-xs text-gray-700 dark:text-gray-300 py-1">
                                <svg class="w-3 h-3 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <polyline points="9 17 14 12 9 7"/>
                                </svg>
                                ${escapeHtml(f)}
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        messageDiv.innerHTML = `
            <div class="max-w-full w-full">
                <div class="text-sm leading-relaxed text-gray-800 dark:text-gray-200 w-full">${contentHtml}</div>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">完成于 ${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
    } else if (type === 'failed' && data) {
        messageDiv.innerHTML = `
            <div class="max-w-full w-full">
                <div class="text-sm leading-relaxed text-gray-800 dark:text-gray-200 w-full">
                    <div class="font-semibold mb-3 text-red-600 dark:text-red-400">任务失败：${data.status}</div>
                    ${data.error ? `<div class="log-output">${escapeHtml(data.error)}</div>` : ''}
                    <div class="mt-3 text-gray-500 dark:text-gray-400 text-xs">请检查指令或文件，然后重试。</div>
                </div>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">失败于 ${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
    } else if (type === 'error') {
        messageDiv.innerHTML = `
            <div class="max-w-full">
                <div class="text-sm text-red-600 dark:text-red-400">${escapeHtml(data)}</div>
            </div>
            <div class="text-xs text-gray-400 dark:text-gray-500">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
        `;
    }

    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Clean Goose ASCII art
function cleanGooseOutput(text) {
    if (!text) return '';
    text = text.replace(/__\( O\)>.*?new session.*?\n/g, '');
    text = text.replace(/\\____\).*?\/workspace\n/g, '');
    text = text.replace(/L L\s+goose is ready\n/g, '');
    text = text.replace(/^__\( O\)/gm, '');
    text = text.replace(/^\\____\)/gm, '');
    text = text.replace(/^\s*L L\s*$/gm, '');
    text = text.replace(/^\s*[▸▶]\s*(tree|shell|glob|grep|read|write|edit|list|webfetch|task|todo_write|todoread|question)\s*$/gm, '\n**[$1]**');
    text = text.replace(/^\s*(path|content|command|todo|files):\s*/gm, '- **$1:** ');
    text = text.replace(/^\s*\[\d+\]\s*$/gm, '');
    const aptMatch = text.match(/(Get:.*?Fetched.*?\nReading package lists\.\.\.\nBuilding dependency tree\.\.\.\nReading state information\.\.\.)/s);
    if (aptMatch) {
        text = text.replace(/(Get:.*?Fetched.*?\nReading package lists\.\.\.\nBuilding dependency tree\.\.\.\nReading state information\.\.\.)/s, '📦 正在安装依赖包...\n');
    }
    text = text.replace(/(update-alternatives:.*?\n?)+/g, '');
    text = text.replace(/\n{3,}/g, '\n\n');
    text = text.replace(/^\n+/, '');
    text = text.replace(/\n+$/, '');
    return text.trim();
}

// Create collapsible tool call component
function createToolCall(title, subtitle, content, isLoading = false) {
    const toolId = 'tool-' + Date.now();
    return `
        <div class="w-full my-2 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
            <button onclick="toggleTool('${toolId}')" class="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-150 cursor-pointer text-left" id="${toolId}-trigger" aria-expanded="false">
                <svg class="w-4 h-4 text-gray-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 17 10 11 4 5"/>
                    <line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span class="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">${escapeHtml(title)}</span>
                    ${subtitle ? `<span class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(subtitle)}</span>` : ''}
                </div>
                <svg class="w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200" id="${toolId}-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="9 18 15 12 9 6"/>
                </svg>
            </button>
            <div class="tool-content collapsed bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700" id="${toolId}-content">
                <div class="p-3">
                    <div class="log-output">${escapeHtml(content)}</div>
                </div>
            </div>
        </div>
    `;
}

function toggleTool(toolId) {
    const content = document.getElementById(toolId + '-content');
    const trigger = document.getElementById(toolId + '-trigger');
    const arrow = document.getElementById(toolId + '-arrow');

    if (!content || !trigger) return;

    const isCollapsed = content.classList.contains('collapsed');

    if (isCollapsed) {
        content.classList.remove('collapsed');
        trigger.setAttribute('aria-expanded', 'true');
        if (arrow) arrow.classList.add('rotate-90');
    } else {
        content.classList.add('collapsed');
        trigger.setAttribute('aria-expanded', 'false');
        if (arrow) arrow.classList.remove('rotate-90');
    }
}

function renderMarkdown(text) {
    if (!text) return '';
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function(code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(code, { language: lang }).value;
                } catch (e) {}
            }
            return hljs.highlightAuto(code).value;
        }
    });
    return marked.parse(text);
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    fetch(`${API_BASE}/api/files/input`, { method: 'DELETE', keepalive: true }).catch(() => {});
    fetch(`${API_BASE}/api/files/output`, { method: 'DELETE', keepalive: true }).catch(() => {});
});
