// UI 管理模块
const UI = {
    // 元素缓存
    elements: {},

    // 初始化
    init() {
        this.cacheElements();
        this.setupEventListeners();
        this.initializeEmojiPicker();
    },

    // 缓存 DOM 元素
    cacheElements() {
        this.elements = {
            // 页面
            authPage: document.getElementById('auth-page'),
            chatPage: document.getElementById('chat-page'),
            
            // 认证表单
            loginForm: document.getElementById('login-form'),
            registerForm: document.getElementById('register-form'),
            showRegisterBtn: document.getElementById('show-register'),
            showLoginBtn: document.getElementById('show-login'),
            
            // 用户信息
            userAvatar: document.getElementById('user-avatar'),
            userName: document.getElementById('user-name'),
            logoutBtn: document.getElementById('logout-btn'),
            
            // 群组
            groupList: document.getElementById('group-list'),
            createGroupBtn: document.getElementById('create-group-btn'),
            joinGroupBtn: document.getElementById('join-group-btn'),
            currentGroupName: document.getElementById('current-group-name'),
            groupId: document.getElementById('group-id'),
            groupSettingsBtn: document.getElementById('group-settings-btn'),
            
            // 消息
            messagesContainer: document.getElementById('messages-container'),
            messageInput: document.getElementById('message-input'),
            sendBtn: document.getElementById('send-btn'),
            imageBtn: document.getElementById('image-btn'),
            imageUpload: document.getElementById('image-upload'),
            emojiBtn: document.getElementById('emoji-btn'),
            emojiPicker: document.getElementById('emoji-picker'),
            
            // 状态指示
            typingIndicator: document.getElementById('typing-indicator'),
            pinnedMessage: document.getElementById('pinned-message'),
            replyPreview: document.getElementById('reply-preview'),
            
            // 成员列表
            membersList: document.getElementById('members-list'),
            memberCount: document.getElementById('member-count'),
            
            // 模态框
            createGroupModal: document.getElementById('create-group-modal'),
            joinGroupModal: document.getElementById('join-group-modal'),
            groupSettingsModal: document.getElementById('group-settings-modal'),
            
            // Toast
            toastContainer: document.getElementById('toast-container')
        };
    },

    // 设置事件监听器
    setupEventListeners() {
        // 认证切换
        this.elements.showRegisterBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showRegisterForm();
        });

        this.elements.showLoginBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.showLoginForm();
        });

        // 登录表单
        this.elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            await App.handleLogin(username, password);
        });

        // 注册表单
        this.elements.registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('register-username').value.trim();
            const password = document.getElementById('register-password').value;
            const confirm = document.getElementById('register-confirm').value;
            
            if (password !== confirm) {
                this.showToast('两次密码输入不一致', 'error');
                return;
            }
            
            await App.handleRegister(username, password);
        });

        // 登出
        this.elements.logoutBtn.addEventListener('click', () => {
            App.handleLogout();
        });

        // 创建群组
        this.elements.createGroupBtn.addEventListener('click', () => {
            this.showModal('createGroupModal');
        });

        document.getElementById('create-group-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('new-group-name').value.trim();
            const desc = document.getElementById('new-group-desc').value.trim();
            await App.handleCreateGroup(name, desc);
        });

        // 加入群组
        this.elements.joinGroupBtn.addEventListener('click', () => {
            this.showModal('joinGroupModal');
        });

        document.getElementById('join-group-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupId = document.getElementById('join-group-id').value.trim();
            await App.handleJoinGroup(groupId);
        });

        // 群组设置
        this.elements.groupSettingsBtn.addEventListener('click', () => {
            this.showModal('groupSettingsModal');
        });

        // 关闭模态框
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // 点击模态框外部关闭
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });

        // 发送消息
        this.elements.sendBtn.addEventListener('click', () => {
            App.handleSendMessage();
        });

        // 输入框事件
        this.elements.messageInput.addEventListener('keydown', (e) => {
            // Ctrl+Enter 发送
            if (e.ctrlKey && e.key === 'Enter') {
                e.preventDefault();
                App.handleSendMessage();
            }
        });

        // 自动调整输入框高度
        this.elements.messageInput.addEventListener('input', (e) => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            
            // 发送输入状态
            if (AppState.currentGroup) {
                App.handleTyping();
            }
        });

        // 粘贴事件（处理图片）
        this.elements.messageInput.addEventListener('paste', (e) => {
            App.handlePaste(e);
        });

        // 图片上传
        this.elements.imageBtn.addEventListener('click', () => {
            this.elements.imageUpload.click();
        });

        this.elements.imageUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await App.handleImageUpload(file);
            }
            e.target.value = ''; // 重置 input
        });

        // Emoji 选择器
        this.elements.emojiBtn.addEventListener('click', () => {
            this.toggleEmojiPicker();
        });

        // 点击外部关闭 emoji 选择器
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#emoji-btn') && !e.target.closest('#emoji-picker')) {
                this.elements.emojiPicker.style.display = 'none';
            }
        });

        // 取消引用
        document.querySelector('.cancel-reply').addEventListener('click', () => {
            AppState.replyTo = null;
            this.elements.replyPreview.style.display = 'none';
        });

        // 关闭置顶消息
        document.querySelector('.close-pinned').addEventListener('click', () => {
            this.hidePinnedMessage();
        });
    },

    // 初始化 Emoji 选择器
    initializeEmojiPicker() {
        const grid = this.elements.emojiPicker.querySelector('.emoji-grid');
        CONFIG.EMOJIS.forEach(emoji => {
            const item = document.createElement('div');
            item.className = 'emoji-item';
            item.textContent = emoji;
            item.addEventListener('click', () => {
                this.insertEmoji(emoji);
            });
            grid.appendChild(item);
        });
    },

    // 切换 Emoji 选择器
    toggleEmojiPicker() {
        const isVisible = this.elements.emojiPicker.style.display === 'block';
        this.elements.emojiPicker.style.display = isVisible ? 'none' : 'block';
    },

    // 插入 Emoji
    insertEmoji(emoji) {
        const input = this.elements.messageInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const text = input.value;
        
        input.value = text.substring(0, start) + emoji + text.substring(end);
        input.selectionStart = input.selectionEnd = start + emoji.length;
        input.focus();
        
        this.elements.emojiPicker.style.display = 'none';
    },

    // 显示注册表单
    showRegisterForm() {
        this.elements.loginForm.classList.remove('active');
        this.elements.registerForm.classList.add('active');
    },

    // 显示登录表单
    showLoginForm() {
        this.elements.registerForm.classList.remove('active');
        this.elements.loginForm.classList.add('active');
    },

    // 显示聊天页面
    showChatPage() {
        this.elements.authPage.classList.remove('active');
        this.elements.chatPage.classList.add('active');
    },

    // 显示认证页面
    showAuthPage() {
        this.elements.chatPage.classList.remove('active');
        this.elements.authPage.classList.add('active');
    },

    // 设置用户信息
    setUserInfo(user) {
        this.elements.userName.textContent = user.username;
        this.elements.userAvatar.textContent = user.username.charAt(0).toUpperCase();
    },

    // 渲染群组列表
    renderGroupList(groups) {
        this.elements.groupList.innerHTML = '';
        
        groups.forEach(group => {
            const item = document.createElement('div');
            item.className = 'group-item';
            item.dataset.groupId = group.id;
            
            item.innerHTML = `
                <h4>${this.escapeHtml(group.name)}</h4>
                <p>${this.escapeHtml(group.description || '暂无描述')}</p>
            `;
            
            item.addEventListener('click', () => {
                App.handleSelectGroup(group);
            });
            
            this.elements.groupList.appendChild(item);
        });
    },

    // 选中群组
    selectGroup(groupId) {
        // 移除所有选中状态
        document.querySelectorAll('.group-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // 添加选中状态
        const item = document.querySelector(`.group-item[data-group-id="${groupId}"]`);
        if (item) {
            item.classList.add('active');
        }
    },

    // 设置当前群组信息
    setCurrentGroup(group) {
        this.elements.currentGroupName.textContent = group.name;
        this.elements.groupId.textContent = `ID: ${group.id}`;
    },

    // 清空消息列表
    clearMessages() {
        this.elements.messagesContainer.innerHTML = '';
    },

    // 渲染消息列表
    renderMessages(messages, currentUserId) {
        this.clearMessages();
        
        if (messages.length === 0) {
            this.showWelcomeMessage();
            return;
        }
        
        messages.forEach(message => {
            this.addMessage(message, currentUserId, false);
        });
        
        this.scrollToBottom();
    },

    // 显示欢迎消息
    showWelcomeMessage() {
        this.elements.messagesContainer.innerHTML = `
            <div class="welcome-message">
                <svg viewBox="0 0 100 100" fill="none">
                    <circle cx="50" cy="50" r="45" fill="url(#gradient2)" opacity="0.1"/>
                    <path d="M30 40c0-3 2-5 5-5h30c3 0 5 2 5 5v20c0 3-2 5-5 5H35c-3 0-5-2-5-5V40z" fill="url(#gradient2)"/>
                    <circle cx="42" cy="48" r="2" fill="white"/>
                    <circle cx="50" cy="48" r="2" fill="white"/>
                    <circle cx="58" cy="48" r="2" fill="white"/>
                    <defs>
                        <linearGradient id="gradient2" x1="0" y1="0" x2="100" y2="100">
                            <stop offset="0%" stop-color="#007AFF"/>
                            <stop offset="100%" stop-color="#5856D6"/>
                        </linearGradient>
                    </defs>
                </svg>
                <h3>开始聊天吧</h3>
                <p>发送消息与群组成员交流</p>
            </div>
        `;
    },

    // 添加消息
    addMessage(message, currentUserId, shouldScroll = true) {
        // 如果存在欢迎消息，先移除
        const welcomeMsg = this.elements.messagesContainer.querySelector('.welcome-message');
        if (welcomeMsg) {
            welcomeMsg.remove();
        }

        const isOwn = message.userId === currentUserId;
        const messageEl = document.createElement('div');
        messageEl.className = `message ${isOwn ? 'own' : ''}`;
        messageEl.dataset.messageId = message.id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.textContent = (message.username || 'U').charAt(0).toUpperCase();

        const content = document.createElement('div');
        content.className = 'message-content';

        const header = document.createElement('div');
        header.className = 'message-header';
        header.innerHTML = `
            <span class="message-sender">${this.escapeHtml(message.username || '未知用户')}</span>
            <span class="message-time">${this.formatTime(message.createdAt)}</span>
        `;

        content.appendChild(header);

        // 引用消息
        if (message.replyTo) {
            const reply = document.createElement('div');
            reply.className = 'message-reply';
            reply.textContent = `回复: ${message.replyTo.content}`;
            reply.addEventListener('click', () => {
                this.scrollToMessage(message.replyTo.id);
            });
            content.appendChild(reply);
        }

        // 消息气泡
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';

        if (message.type === 'text') {
            bubble.textContent = message.content;
        } else if (message.type === 'image') {
            const img = document.createElement('img');
            img.src = message.content;
            img.alt = '图片';
            bubble.appendChild(img);
        }

        if (message.edited) {
            const edited = document.createElement('span');
            edited.className = 'message-edited';
            edited.textContent = '已编辑';
            bubble.appendChild(edited);
        }

        content.appendChild(bubble);

        // 消息操作按钮
        const actions = document.createElement('div');
        actions.className = 'message-actions';

        const replyBtn = document.createElement('button');
        replyBtn.className = 'message-action-btn';
        replyBtn.textContent = '回复';
        replyBtn.addEventListener('click', () => {
            App.handleReply(message);
        });
        actions.appendChild(replyBtn);

        if (isOwn) {
            const editBtn = document.createElement('button');
            editBtn.className = 'message-action-btn';
            editBtn.textContent = '编辑';
            editBtn.addEventListener('click', () => {
                App.handleEdit(message);
            });
            actions.appendChild(editBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'message-action-btn';
            deleteBtn.textContent = '撤回';
            deleteBtn.addEventListener('click', () => {
                App.handleDelete(message.id);
            });
            actions.appendChild(deleteBtn);
        }

        content.appendChild(actions);

        messageEl.appendChild(avatar);
        messageEl.appendChild(content);

        this.elements.messagesContainer.appendChild(messageEl);

        if (shouldScroll) {
            this.scrollToBottom();
        }
    },

    // 更新消息
    updateMessage(messageId, content) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            const bubble = messageEl.querySelector('.message-bubble');
            bubble.textContent = content;
            
            // 添加已编辑标记
            if (!bubble.querySelector('.message-edited')) {
                const edited = document.createElement('span');
                edited.className = 'message-edited';
                edited.textContent = '已编辑';
                bubble.appendChild(edited);
            }
        }
    },

    // 删除消息
    removeMessage(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.remove();
        }
    },

    // 滚动到底部
    scrollToBottom() {
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    },

    // 滚动到指定消息
    scrollToMessage(messageId) {
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageEl.classList.add('highlight');
            setTimeout(() => messageEl.classList.remove('highlight'), 2000);
        }
    },

    // 显示输入状态
    showTypingIndicator(username, isTyping) {
        if (isTyping) {
            this.elements.typingIndicator.querySelector('.typing-user').textContent = username;
            this.elements.typingIndicator.style.display = 'flex';
        } else {
            this.elements.typingIndicator.style.display = 'none';
        }
    },

    // 显示置顶消息
    showPinnedMessage(message) {
        this.elements.pinnedMessage.querySelector('.pinned-text').textContent = message.content;
        this.elements.pinnedMessage.style.display = 'flex';
    },

    // 隐藏置顶消息
    hidePinnedMessage() {
        this.elements.pinnedMessage.style.display = 'none';
    },

    // 显示回复预览
    showReplyPreview(message) {
        this.elements.replyPreview.querySelector('.reply-message').textContent = message.content;
        this.elements.replyPreview.style.display = 'flex';
    },

    // 隐藏回复预览
    hideReplyPreview() {
        this.elements.replyPreview.style.display = 'none';
    },

    // 渲染成员列表
    renderMembers(members) {
        this.elements.membersList.innerHTML = '';
        this.elements.memberCount.textContent = members.length;

        members.forEach(member => {
            const item = document.createElement('div');
            item.className = 'member-item';
            item.dataset.userId = member.id;

            item.innerHTML = `
                <div class="member-avatar ${member.online ? 'online' : ''}">
                    ${member.username.charAt(0).toUpperCase()}
                </div>
                <div class="member-info">
                    <div class="member-name">${this.escapeHtml(member.username)}</div>
                    <div class="member-role">${this.getMemberRole(member.role)}</div>
                </div>
            `;

            this.elements.membersList.appendChild(item);
        });
    },

    // 更新成员在线状态
    updateMemberStatus(userId, online) {
        const memberEl = document.querySelector(`[data-user-id="${userId}"] .member-avatar`);
        if (memberEl) {
            if (online) {
                memberEl.classList.add('online');
            } else {
                memberEl.classList.remove('online');
            }
        }
    },

    // 获取成员角色文本
    getMemberRole(role) {
        const roles = {
            'owner': '群主',
            'admin': '管理员',
            'member': '成员'
        };
        return roles[role] || '成员';
    },

    // 显示模态框
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    // 隐藏模态框
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    // 显示 Toast 通知
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        const icons = {
            success: '✓',
            error: '✕',
            info: 'ℹ'
        };

        toast.innerHTML = `
            <div class="toast-icon">${icons[type] || icons.info}</div>
            <div class="toast-message">${this.escapeHtml(message)}</div>
        `;

        this.elements.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    },

    // 格式化时间
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        // 一分钟内
        if (diff < 60000) {
            return '刚刚';
        }

        // 一小时内
        if (diff < 3600000) {
            return `${Math.floor(diff / 60000)} 分钟前`;
        }

        // 今天
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }

        // 昨天
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
        }

        // 其他
        return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' +
               date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    },

    // HTML 转义
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
};
