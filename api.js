// API 请求模块
const API = {
    // 获取 Token
    getToken() {
        return localStorage.getItem(CONFIG.STORAGE_KEYS.TOKEN);
    },

    // 设置 Token
    setToken(token) {
        localStorage.setItem(CONFIG.STORAGE_KEYS.TOKEN, token);
    },

    // 清除 Token
    clearToken() {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.TOKEN);
    },

    // 通用请求方法
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
                ...options,
                headers
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || '请求失败');
            }

            return data;
        } catch (error) {
            console.error('API 请求错误:', error);
            throw error;
        }
    },

    // 用户注册
    async register(username, password) {
        return this.request('/api/register', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    // 用户登录
    async login(username, password) {
        return this.request('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
    },

    // 获取用户信息
    async getUserProfile() {
        return this.request('/api/user/profile');
    },

    // 获取用户群组列表
    async getGroups() {
        return this.request('/api/groups');
    },

    // 创建群组
    async createGroup(name, description) {
        return this.request('/api/groups', {
            method: 'POST',
            body: JSON.stringify({ name, description })
        });
    },

    // 加入群组
    async joinGroup(groupId) {
        return this.request('/api/groups/join', {
            method: 'POST',
            body: JSON.stringify({ groupId })
        });
    },

    // 获取群组详情
    async getGroupDetails(groupId) {
        return this.request(`/api/groups/${groupId}`);
    },

    // 获取群组成员
    async getGroupMembers(groupId) {
        return this.request(`/api/groups/${groupId}/members`);
    },

    // 获取历史消息
    async getMessages(groupId, limit = 50, before = null) {
        let url = `/api/groups/${groupId}/messages?limit=${limit}`;
        if (before) {
            url += `&before=${before}`;
        }
        return this.request(url);
    },

    // 发送消息
    async sendMessage(groupId, content, type = 'text', replyTo = null) {
        return this.request('/api/messages', {
            method: 'POST',
            body: JSON.stringify({
                groupId,
                content,
                type,
                replyTo
            })
        });
    },

    // 编辑消息
    async editMessage(messageId, content) {
        return this.request(`/api/messages/${messageId}`, {
            method: 'PUT',
            body: JSON.stringify({ content })
        });
    },

    // 删除消息
    async deleteMessage(messageId) {
        return this.request(`/api/messages/${messageId}`, {
            method: 'DELETE'
        });
    },

    // 上传图片
    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);

        const token = this.getToken();
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${CONFIG.API_BASE_URL}/api/upload/image`, {
            method: 'POST',
            headers,
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || '上传失败');
        }

        return data;
    },

    // 设置群公告
    async setAnnouncement(groupId, announcement) {
        return this.request(`/api/groups/${groupId}/announcement`, {
            method: 'PUT',
            body: JSON.stringify({ announcement })
        });
    },

    // 设置全员禁言
    async setMuteAll(groupId, mute) {
        return this.request(`/api/groups/${groupId}/mute-all`, {
            method: 'PUT',
            body: JSON.stringify({ mute })
        });
    },

    // 置顶消息
    async pinMessage(groupId, messageId) {
        return this.request(`/api/groups/${groupId}/pin`, {
            method: 'PUT',
            body: JSON.stringify({ messageId })
        });
    },

    // 取消置顶
    async unpinMessage(groupId) {
        return this.request(`/api/groups/${groupId}/pin`, {
            method: 'DELETE'
        });
    },

    // 退出群组
    async leaveGroup(groupId) {
        return this.request(`/api/groups/${groupId}/leave`, {
            method: 'POST'
        });
    }
};
