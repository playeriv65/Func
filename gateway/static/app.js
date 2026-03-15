const API_BASE = '';
let currentTaskId = null;
let pollingInterval = null;
let currentTheme = 'auto';
let isComplexMode = false;

// Mode switching
function toggleMode() {
    isComplexMode = !isComplexMode;
    
    const modeSwitch = document.getElementById('modeSwitch');
    const centerPanel = document.getElementById('centerPanel');
    const instructionInput = document.getElementById('instruction');
    const chatInstruction = document.getElementById('chatInstruction');
    
    if (isComplexMode) {
        modeSwitch.classList.add('active');
        centerPanel.classList.add('complex-mode');
        if (chatInstruction) chatInstruction.focus();
    } else {
        modeSwitch.classList.remove('active');
        centerPanel.classList.remove('complex-mode');
        if (instructionInput) instructionInput.focus();
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
    const sunIcon = document.querySelector('.sun-icon');
    const sunRays = document.querySelector('.sun-rays');
    const moonIcon = document.querySelector('.moon-icon');
    const themeText = document.getElementById('themeText');
    
    html.removeAttribute('data-theme');
    
    if (currentTheme === 'light') {
        html.setAttribute('data-theme', 'light');
        sunIcon.style.display = 'none';
        sunRays.style.display = 'none';
        moonIcon.style.display = 'block';
        themeText.textContent = '浅色';
    } else if (currentTheme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        sunIcon.style.display = 'block';
        sunRays.style.display = 'block';
        moonIcon.style.display = 'none';
        themeText.textContent = '深色';
    } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (isDark) {
            sunIcon.style.display = 'block';
            sunRays.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            sunRays.style.display = 'none';
            moonIcon.style.display = 'block';
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

if (typeof lucide !== 'undefined') lucide.createIcons();
initTheme();

// Upload handling
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');

uploadZone.addEventListener('click', () => fileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
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
    } catch (error) { console.error('Upload error:', error); return false; }
}

async function loadInputFiles() {
    try {
        const response = await fetch(`${API_BASE}/api/files/input`);
        const data = await response.json();
        const fileList = document.getElementById('inputFileList');
        const fileCount = document.getElementById('fileCount');
        
        fileCount.textContent = data.files.length;
        
        if (data.files.length === 0) {
            fileList.innerHTML = '<div class="empty-state">暂无输入文件</div>';
            return;
        }
        
        fileList.innerHTML = '';
        data.files.forEach(filename => {
            const item = document.createElement('div');
            item.className = 'file-item';
            item.innerHTML = `
                <svg class="file-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                </svg>
                <span class="file-name">${escapeHtml(filename)}</span>
                <button class="btn btn-icon btn-sm" onclick="deleteInputFile('${escapeHtml(filename)}')" title="删除">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"/>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                </button>
            `;
            fileList.appendChild(item);
        });
    } catch (error) { console.error('Error loading input files:', error); }
}

async function deleteInputFile(filename) {
    try {
        const response = await fetch(`${API_BASE}/api/files/input/${filename}`, { method: 'DELETE' });
        if (response.ok) {
            await loadInputFiles();
            showToast('success', `已删除：${filename}`);
        }
    } catch (error) { console.error('Error deleting file:', error); }
}

async function deleteOutputFile(filename) {
    if (!confirm(`确定要删除 ${filename} 吗？`)) return;
    
    try {
        const response = await fetch(`${API_BASE}/api/files/output/${filename}`, { method: 'DELETE' });
        if (response.ok) {
            await loadOutputFiles();
            showToast('success', `已删除：${filename}`);
        }
    } catch (error) { console.error('Error deleting file:', error); }
}

// Toast notification
function showToast(type, message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    const toastIcon = toast.querySelector('.toast-icon');
    
    // Set icon based on type
    if (type === 'success') {
        toastIcon.innerHTML = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>';
        toast.className = 'toast success';
    } else {
        toastIcon.innerHTML = '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>';
        toast.className = 'toast error';
    }
    
    toastMessage.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Execute task (simple mode - no output display)
async function executeTask() {
    const instruction = document.getElementById('instruction').value.trim();
    if (!instruction) { showToast('error', '请输入指令'); return; }
    
    const runBtn = document.getElementById('runBtn');
    const instructionInput = document.getElementById('instruction');
    
    runBtn.disabled = true;
    runBtn.classList.add('running');
    
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
            runBtn.disabled = false;
            runBtn.classList.remove('running');
        }
    } catch (error) {
        showToast('error', error.message);
        runBtn.disabled = false;
        runBtn.classList.remove('running');
    }
}

// Execute task (complex mode - with chat output)
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
                document.getElementById('runBtn').disabled = false;
                document.getElementById('runBtn').classList.remove('running');
            } else if (data.status === 'failed' || data.status === 'timeout') {
                clearInterval(pollingInterval);
                updateStatus('ready', '就绪');
                showToast('error', `任务失败：${data.status}`);
                document.getElementById('runBtn').disabled = false;
                document.getElementById('runBtn').classList.remove('running');
            }
        } catch (error) { console.error('Polling error:', error); }
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
        } catch (error) { console.error('Polling error:', error); }
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
        dot.classList.add('running');
        textEl.textContent = text;
    } else {
        dot.classList.remove('running');
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
                item.className = 'output-file';
                const fileName = typeof file === 'string' ? file : file.name;
                const fileSize = typeof file === 'object' && file.size ? file.size : 0;
                const fileMod = typeof file === 'object' && file.modified ? file.modified : Date.now();
                item.innerHTML = `
                    <div class="output-file-name">${escapeHtml(fileName)}</div>
                    <div class="output-file-info">
                        大小：${formatFileSize(fileSize)} · 修改时间：${new Date(fileMod).toLocaleString('zh-CN')}
                    </div>
                    <div style="display: flex; gap: 6px; margin-top: 6px;">
                        <a href="${API_BASE}/api/files/download/${encodeURIComponent(fileName)}" class="btn btn-success btn-sm" style="flex: 1;">下载</a>
                        <button onclick="deleteOutputFile('${escapeHtml(fileName)}')" class="btn btn-icon btn-sm" title="删除">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
                <div class="empty-state">
                    <svg class="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    <div>暂无输出文件</div>
                </div>
            `;
        }
    } catch (error) { console.error('Error loading output files:', error); }
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
textarea.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 300) + 'px';
});

// Enter to run (without shift)
textarea.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        executeTask();
    }
});

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
    messageDiv.className = 'message message-ai';
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(content)}</div>
            <div class="message-meta">刚刚</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addUserMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-user';
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">${escapeHtml(content)}</div>
            <div class="message-meta">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
        </div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addSystemMessage(content) {
    const chatMessages = document.getElementById('chatMessages');
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = 'text-align: center; margin: 10px 0;';
    messageDiv.innerHTML = `
        <span style="background: var(--bg-tertiary); padding: 6px 12px; border-radius: 999px; font-size: 11px; color: var(--text-secondary);">
            ${escapeHtml(content)}
        </span>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addAIThinkingMessage() {
    const chatMessages = document.getElementById('chatMessages');
    const messageId = 'msg-' + Date.now();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message message-ai';
    messageDiv.id = messageId;
    messageDiv.innerHTML = `
        <div class="message-content">
            <div class="message-bubble">
                <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary);">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
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
            <div class="message-content">
                <div class="message-bubble">收到指令，开始执行任务...</div>
                <div class="message-meta">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    } else if (type === 'running' && data) {
        const cleanedOutput = data.stdout ? cleanGooseOutput(data.stdout) : '';
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">
                    ${cleanedOutput ? createToolCall('执行中', '正在处理任务', cleanedOutput, true) : ''}
                    <div style="display: flex; align-items: center; gap: 8px; color: var(--text-secondary); margin-top: 12px;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                        <span>正在处理，请稍候...</span>
                    </div>
                </div>
                <div class="message-meta">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    } else if (type === 'completed' && data) {
        let contentHtml = '';
        
        if (data.stdout) {
            const cleaned = cleanGooseOutput(data.stdout);
            contentHtml += `<div class="markdown-body">${renderMarkdown(cleaned)}</div>`;
        }
        
        if (data.output_files && data.output_files.length > 0) {
            contentHtml += `
                <div style="margin-top: 16px; padding: 12px; background: var(--success-bg); border: 1px solid var(--success); border-radius: var(--radius-md);">
                    <strong style="color: var(--success); display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                        </svg>
                        生成文件
                    </strong>
                    <div style="margin-left: 8px;">
                        ${data.output_files.map(f => `
                            <div style="display: flex; align-items: center; gap: 6px; font-family: monospace; font-size: 11px; color: var(--text-primary); padding: 4px 0;">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" stroke-width="2">
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
            <div class="message-content">
                <div class="message-bubble">
                    ${contentHtml}
                </div>
                <div class="message-meta">完成于 ${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    } else if (type === 'failed' && data) {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">
                    <div style="font-weight: 600; margin-bottom: 12px; color: var(--error);">
                        任务失败：${data.status}
                    </div>
                    ${data.error ? `<div class="log-output">${escapeHtml(data.error)}</div>` : ''}
                    <div style="margin-top: 12px; color: var(--text-secondary); font-size: 12px;">
                        请检查指令或文件，然后重试。
                    </div>
                </div>
                <div class="message-meta">失败于 ${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
        `;
    } else if (type === 'error') {
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="message-bubble">${escapeHtml(data)}</div>
                <div class="message-meta">${new Date().toLocaleTimeString('zh-CN', {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
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
        <div class="tool-call">
            <div class="tool-trigger" onclick="toggleTool('${toolId}')" role="button" aria-expanded="false" id="${toolId}-trigger">
                <svg class="tool-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 17 10 11 4 5"/>
                    <line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
                <div class="tool-trigger-content">
                    <span class="tool-trigger-title">${escapeHtml(title)}</span>
                    ${subtitle ? `<span class="tool-trigger-subtitle">${escapeHtml(subtitle)}</span>` : ''}
                </div>
                <div class="tool-trigger-arrow">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="9 18 15 12 9 6"/>
                    </svg>
                </div>
            </div>
            <div class="tool-content collapsed" id="${toolId}-content">
                <div class="tool-content-inner">
                    <div class="log-output">${escapeHtml(content)}</div>
                </div>
            </div>
        </div>
    `;
}

function toggleTool(toolId) {
    const content = document.getElementById(toolId + '-content');
    const trigger = document.getElementById(toolId + '-trigger');
    
    if (!content || !trigger) return;
    
    const isCollapsed = content.classList.contains('collapsed');
    
    if (isCollapsed) {
        content.classList.remove('collapsed');
        trigger.setAttribute('aria-expanded', 'true');
    } else {
        content.classList.add('collapsed');
        trigger.setAttribute('aria-expanded', 'false');
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

// Pulse animation for running state
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
`;
document.head.appendChild(style);

loadInputFiles();
loadOutputFiles();

window.addEventListener('beforeunload', () => {
    fetch(`${API_BASE}/api/files/input`, { method: 'DELETE', keepalive: true }).catch(() => {});
    fetch(`${API_BASE}/api/files/output`, { method: 'DELETE', keepalive: true }).catch(() => {});
});
