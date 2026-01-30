// Socket.IO 连接管理
const SocketManager = {
    socket: null,
    reconnectAttempts: 0,
    maxReconnectAttempts: 5,

    // 初始化连接
    init() {
        const token = API.getToken();
        if (!token) {
            console.warn('未找到 Token,无法建立 Socket 连接');
            return;
        }

        this.socket = io(CONFIG.SOCKET_URL, {
            auth: {
                token
            },
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            reconnectionAttempts: this.maxReconnectAttempts
        });

        this.setupEventListeners();
    },

    // 设置事件监听器
    setupEventListeners() {
        // 连接成功
        this.socket.on('connect', () => {
            console.log('Socket 连接成功');
            this.reconnectAttempts = 0;
            UI.showToast('已连接到服务器', 'success');
        });

        // 连接错误
        this.socket.on('connect_error', (error) => {
            console.error('Socket 连接错误:', error);
            this.reconnectAttempts++;
            
            if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                UI.showToast('连接服务器失败，请刷新页面重试', 'error');
            }
        });

        // 断开连接
        this.socket.on('disconnect', (reason) => {
            console.log('Socket 断开连接:', reason);
            if (reason === 'io server disconnect') {
                // 服务器主动断开，尝试重连
                this.socket.connect();
            }
        });

        // 新消息
        this.socket.on('new_message', (message) => {
            console.log('收到新消息:', message);
            this.handleNewMessage(message);
        });

        // 消息已编辑
        this.socket.on('message_edited', (data) => {
            console.log('消息已编辑:', data);
            this.handleMessageEdited(data);
        });

        // 消息已删除
        this.socket.on('message_deleted', (data) => {
            console.log('消息已删除:', data);
            this.handleMessageDeleted(data);
        });

        // 用户上线
        this.socket.on('user_online', (data) => {
            console.log('用户上线:', data);
            this.handleUserOnline(data);
        });

        // 用户下线
        this.socket.on('user_offline', (data) => {
            console.log('用户下线:', data);
            this.handleUserOffline(data);
        });

        // 用户正在输入
        this.socket.on('user_typing', (data) => {
            console.log('用户正在输入:', data);
            this.handleUserTyping(data);
        });

        // 消息已置顶
        this.socket.on('message_pinned', (data) => {
            console.log('消息已置顶:', data);
            this.handleMessagePinned(data);
        });

        // 取消置顶
        this.socket.on('message_unpinned', () => {
            console.log('取消置顶');
            UI.hidePinnedMessage();
        });

        // 群组更新
        this.socket.on('group_updated', (data) => {
            console.log('群组更新:', data);
            this.handleGroupUpdated(data);
        });
    },

    // 加入群组
    joinGroup(groupId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('join_group', { groupId });
        }
    },

    // 离开群组
    leaveGroup(groupId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('leave_group', { groupId });
        }
    },

    // 发送消息
    sendMessage(data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('send_message', data);
        }
    },

    // 发送输入状态
    sendTyping(groupId, isTyping) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('typing', { groupId, isTyping });
        }
    },

    // 编辑消息
    editMessage(messageId, content) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('edit_message', { messageId, content });
        }
    },

    // 删除消息
    deleteMessage(messageId) {
        if (this.socket && this.socket.connected) {
            this.socket.emit('delete_message', { messageId });
        }
    },

    // 处理新消息
    handleNewMessage(message) {
        const currentUser = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
        const currentGroup = AppState.currentGroup;

        // 如果消息属于当前群组
        if (currentGroup && message.groupId === currentGroup.id) {
            UI.addMessage(message, currentUser.id);
            
            // 如果不是自己的消息，播放提示音（可选）
            if (message.userId !== currentUser.id) {
                this.playNotificationSound();
            }
        }

        // 更新未读数（如果不在当前群组）
        if (!currentGroup || message.groupId !== currentGroup.id) {
            this.updateUnreadCount(message.groupId);
        }
    },

    // 处理消息编辑
    handleMessageEdited(data) {
        const { messageId, content } = data;
        UI.updateMessage(messageId, content);
    },

    // 处理消息删除
    handleMessageDeleted(data) {
        const { messageId } = data;
        UI.removeMessage(messageId);
    },

    // 处理用户上线
    handleUserOnline(data) {
        const { userId, username } = data;
        UI.updateMemberStatus(userId, true);
    },

    // 处理用户下线
    handleUserOffline(data) {
        const { userId } = data;
        UI.updateMemberStatus(userId, false);
    },

    // 处理用户输入状态
    handleUserTyping(data) {
        const { userId, username, isTyping } = data;
        const currentUser = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
        
        // 不显示自己的输入状态
        if (userId !== currentUser.id) {
            UI.showTypingIndicator(username, isTyping);
        }
    },

    // 处理消息置顶
    handleMessagePinned(data) {
        const { message } = data;
        UI.showPinnedMessage(message);
    },

    // 处理群组更新
    handleGroupUpdated(data) {
        const { group } = data;
        if (AppState.currentGroup && AppState.currentGroup.id === group.id) {
            AppState.currentGroup = group;
            // 可以更新 UI 显示的群组信息
        }
    },

    // 更新未读数
    updateUnreadCount(groupId) {
        // 这里可以实现未读数更新逻辑
        // 例如在群组列表项上显示红点或数字
    },

    // 播放通知音
    playNotificationSound() {
        // 可以添加音频文件播放
        // const audio = new Audio('/sounds/notification.mp3');
        // audio.play().catch(e => console.log('播放提示音失败:', e));
    },

    // 断开连接
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
};
