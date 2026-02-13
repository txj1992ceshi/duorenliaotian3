// ============ 全局变量 ============
const API_URL = window.location.origin;
let socket = null;
let currentUser = null;
let currentGroupId = null;
let currentGroup = null;
let replyToMessage = null;
let typingTimeout = null;
let onlineUsers = new Set();
let pendingAttachment = null;

// ============ 多标签页状态同步 ============
const TabSync = (() => {
  const channelName = 'chatroom_sync';
  const hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';
  const bc = hasBroadcastChannel ? new BroadcastChannel(channelName) : null;

  function publish(payload) {
    const message = { ...payload, ts: Date.now() };
    if (bc) {
      bc.postMessage(message);
      return;
    }
    // fallback: 使用 storage 事件
    try {
      localStorage.setItem(channelName, JSON.stringify(message));
      localStorage.removeItem(channelName);
    } catch (_) {}
  }

function handleMessage(message) {
    if (!message || !message.type) return;

    if (message.type === 'logout') {
      // 其它标签页退出后，本标签页也退出
      if (getToken()) {
        logout({ broadcast: false });
      }
      return;
    }

    if (message.type === 'login' && message.token && message.user) {
      // 其它标签页登录后，本标签页同步登录（若当前未登录）
      if (!getToken()) {
        setToken(message.token);
        setUser(message.user);
        currentUser = message.user;
        connectSocket();
        showPage('app-page');
        loadGroups();
      }
    }
  }

  if (bc) {
    bc.onmessage = (e) => handleMessage(e.data);
  } else {
    window.addEventListener('storage', (e) => {
      if (e.key !== channelName || !e.newValue) return;
      try {
        handleMessage(JSON.parse(e.newValue));
      } catch (_) {}
    });
  }

  return { publish };
})();

// ============ 工具函数 ============

function getToken() {
  return localStorage.getItem('token');
}

function setToken(token) {
  localStorage.setItem('token', token);
}

function removeToken() {
  localStorage.removeItem('token');
}

function getUser() {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
}

function setUser(user) {
  localStorage.setItem('user', JSON.stringify(user));
}

function removeUser() {
  localStorage.removeItem('user');
}

function showPage(pageId) {
  document.querySelectorAll('.auth-page, .app-page').forEach(page => {
    page.style.display = 'none';
  });
  document.getElementById(pageId).style.display = pageId === 'app-page' ? 'flex' : 'flex';

  const tabbar = document.getElementById('mobile-tabbar');
  if (tabbar) {
    if (pageId === 'app-page' && window.innerWidth <= 768) {
      tabbar.style.display = 'flex';
    } else {
      tabbar.style.display = 'none';
    }
  }
}

function showToast(message, type = 'info') {
  // 简单的提示实现
  alert(message);
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  
  // 今天
  if (diff < 86400000 && now.getDate() === date.getDate()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  
  // 昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate()) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  
  // 更早
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }) + ' ' +
         date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

// ============ API 请求函数 ============

async function apiRequest(endpoint, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '请求失败');
  }

  return response.json();
}

// ============ Socket.IO 连接 ============

function connectSocket() {
  const token = getToken();
  if (!token || socket) return;

  socket = io(API_URL);

  socket.on('connect', () => {
    console.log('Socket 已连接');
    socket.emit('authenticate', token);
  });

  socket.on('disconnect', () => {
    console.log('Socket 已断开');
  });

  // 新消息
  socket.on('new_message', (message) => {
    if (message.groupId === currentGroupId) {
      addMessageToUI(message);
      scrollToBottom();
    }
  });

  // 用户正在输入
  socket.on('user_typing', (data) => {
    if (data.groupId === currentGroupId && data.userId !== currentUser.id) {
      showTypingIndicator(data.username);
    }
  });

  socket.on('user_stop_typing', (data) => {
    if (data.groupId === currentGroupId) {
      hideTypingIndicator();
    }
  });

  // 消息已编辑
  socket.on('message_edited', (message) => {
    if (message.groupId === currentGroupId) {
      updateMessageInUI(message);
    }
  });

  // 消息已撤回
  socket.on('message_recalled', (data) => {
    if (data.groupId === currentGroupId) {
      removeMessageFromUI(data.messageId);
    }
  });

  // 消息已置顶
  socket.on('message_pinned', (data) => {
    if (data.groupId === currentGroupId) {
      updateMessagePinStatus(data.messageId, data.pinned);
      if (data.pinned) {
        loadGroupDetails(currentGroupId);
      }
    }
  });

  // 用户上线
  socket.on('user_online', (data) => {
    onlineUsers.add(data.userId);
    updateMemberOnlineStatus(data.userId, true);
  });

  // 用户下线
  socket.on('user_offline', (data) => {
    onlineUsers.delete(data.userId);
    updateMemberOnlineStatus(data.userId, false);
  });

  // 成员加入
  socket.on('member_joined', (data) => {
    if (data.groupId === currentGroupId) {
      loadGroupDetails(currentGroupId);
    }
  });

  // 公告更新
  socket.on('announcement_updated', (data) => {
    if (data.groupId === currentGroupId) {
      updateAnnouncement(data.announcement);
    }
  });

  // 全员禁言更新
  socket.on('mute_all_updated', (data) => {
    if (data.groupId === currentGroupId) {
      currentGroup.muteAll = data.muteAll;
      updateMuteAllUI();
    }
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// ============ 认证相关 ============

// 注册
document.getElementById('register-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('register-username').value.trim();
  const email = document.getElementById('register-email').value.trim();
  const password = document.getElementById('register-password').value;

  if (password.length < 6) {
    showToast('密码至少需要6位字符', 'error');
    return;
  }

  try {
    const data = await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password })
    });

    setToken(data.token);
    setUser(data.user);
    TabSync.publish({ type: 'login', token: data.token, user: data.user });
    currentUser = data.user;

    connectSocket();
    showPage('app-page');
    loadGroups();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// 登录
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;

  try {
    const data = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    setToken(data.token);
    setUser(data.user);
    TabSync.publish({ type: 'login', token: data.token, user: data.user });
    currentUser = data.user;

    connectSocket();
    showPage('app-page');
    loadGroups();
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// 忘记密码链接
document.getElementById('forgot-password-link')?.addEventListener('click', (e) => {
  e.preventDefault();
  showPage('forgot-password-page');
});

// 返回登录
document.getElementById('back-to-login')?.addEventListener('click', (e) => {
  e.preventDefault();
  showPage('auth-page');
});

// 忘记密码表单
document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('forgot-email').value.trim();

  try {
    const data = await apiRequest('/api/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    showToast('重置链接已发送到您的邮箱', 'success');
    
    // 开发环境下显示重置链接
    if (data.devToken) {
      console.log('重置链接:', `${window.location.origin}/reset-password.html?token=${data.devToken}`);
      const shouldOpen = confirm('重置链接已生成(开发模式)。是否立即打开?');
      if (shouldOpen) {
        window.location.href = `/reset-password.html?token=${data.devToken}`;
      }
    } else {
      setTimeout(() => {
        showPage('auth-page');
      }, 2000);
    }
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// 切换登录/注册
document.getElementById('toggle-auth')?.addEventListener('click', (e) => {
  e.preventDefault();

  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');
  const switchText = document.getElementById('auth-switch-text');
  const toggleLink = document.getElementById('toggle-auth');

  if (loginForm.style.display !== 'none') {
    loginForm.style.display = 'none';
    registerForm.style.display = 'flex';
    switchText.textContent = '已有账号? ';
    toggleLink.textContent = '立即登录';
  } else {
    loginForm.style.display = 'flex';
    registerForm.style.display = 'none';
    switchText.textContent = '还没有账号? ';
    toggleLink.textContent = '立即注册';
  }
});

// 退出登录
document.getElementById('logout-btn')?.addEventListener('click', () => {
  if (confirm('确定要退出登录吗?')) {
    logout();
  }
});

function logout({ broadcast = true } = {}) {
  disconnectSocket();
  removeToken();
  removeUser();
  if (broadcast) {
    TabSync.publish({ type: 'logout' });
  }
  currentUser = null;
  currentGroupId = null;
  currentGroup = null;
  showPage('auth-page');
}

// ============ 群组相关 ============

async function loadGroups() {
  try {
    const groups = await apiRequest('/api/groups');
    displayGroups(groups);
  } catch (error) {
    console.error('加载群组失败:', error);
  }
}

function displayGroups(groups) {
  const container = document.getElementById('groups-container');
  container.innerHTML = '';

  if (groups.length === 0) {
    container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 14px;">暂无群组<br>创建或加入一个群组开始聊天</div>';
    return;
  }

  groups.forEach(group => {
    const groupItem = document.createElement('div');
    groupItem.className = 'group-item';
    groupItem.dataset.groupId = group.id;
    
    groupItem.innerHTML = `
      <div class="group-item-name">${group.name}</div>
      <div class="group-item-info">
        <span>${group.members.length} 成员</span>
      </div>
    `;

    groupItem.addEventListener('click', () => {
      selectGroup(group.id);
    });

    container.appendChild(groupItem);
  });
}

async function selectGroup(groupId) {
  currentGroupId = groupId;

  // 更新 UI 选中状态
  document.querySelectorAll('.group-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-group-id="${groupId}"]`)?.classList.add('active');

  // 隐藏欢迎屏幕,显示聊天区域
  document.getElementById('welcome-screen').style.display = 'none';
  document.getElementById('chat-area').style.display = 'flex';

  // 加载群组详情和消息
  await loadGroupDetails(groupId);
  await loadMessages(groupId);

  if (sidebarEl?.classList.contains('open')) {
    closeSidebar();
  }
}

async function loadGroupDetails(groupId) {
  try {
    const group = await apiRequest(`/api/groups/${groupId}`);
    currentGroup = group;

    // 更新头部信息
    document.getElementById('group-name').textContent = group.name;
    document.getElementById('group-members-count').textContent = `${group.members.length} 成员`;

    // 更新公告
    updateAnnouncement(group.announcement);

    // 更新置顶消息
    updatePinnedMessages(group.pinnedMessages);

    // 更新右侧面板
    updateGroupPanel(group);

    // 加入 Socket 房间
    if (socket) {
      socket.emit('join_group', groupId);
    }
  } catch (error) {
    console.error('加载群组详情失败:', error);
  }
}

async function loadMessages(groupId) {
  try {
    const messages = await apiRequest(`/api/groups/${groupId}/messages`);
    displayMessages(messages);
    scrollToBottom();
  } catch (error) {
    console.error('加载消息失败:', error);
  }
}

function displayMessages(messages) {
  const container = document.getElementById('messages-list');
  container.innerHTML = '';

  messages.forEach(message => {
    addMessageToUI(message, false);
  });
}

function addMessageToUI(message, scroll = true) {
  const container = document.getElementById('messages-list');
  const messageEl = document.createElement('div');
  messageEl.className = 'message' + (message.pinned ? ' pinned' : '');
  messageEl.dataset.messageId = message.id;

  let replyHTML = '';
  if (message.replyTo) {
    const replyToMsg = findMessageById(message.replyTo);
    if (replyToMsg) {
      replyHTML = `
        <div class="message-reply-to" onclick="scrollToMessage('${message.replyTo}')">
          <strong>${replyToMsg.username}</strong>
          <p>${replyToMsg.type === 'image' ? '图片' : (replyToMsg.type === 'video' ? '视频' : (replyToMsg.content || ''))}</p>
        </div>
      `;
    }
  }

  let contentHTML = '';
  if (message.type === 'image') {
    const caption = message.content && message.content !== '[图片]' ? `<div class="message-text">${escapeHtml(message.content)}</div>` : '';
    contentHTML = `
      <img src="${message.imageUrl}" class="message-image" alt="图片" onclick="openImageModal('${message.imageUrl}')">
      ${caption}
    `;
  } else if (message.type === 'video') {
    const caption = message.content && message.content !== '[视频]' ? `<div class="message-text">${escapeHtml(message.content)}</div>` : '';
    contentHTML = `
      <video class="message-video" controls preload="metadata" src="${message.imageUrl}">
        您的浏览器不支持 video 标签
      </video>
      ${caption}
    `;
  } else {
    contentHTML = `<div class="message-text">${escapeHtml(message.content)}</div>`;
  }

  const isOwner = currentUser && message.userId === currentUser.id;
  const isAdmin = currentGroup && (currentGroup.ownerId === currentUser?.id || currentGroup.admins.includes(currentUser?.id));

  let actionsHTML = '';
  if (currentUser) {
    actionsHTML = `
      <div class="message-actions">
        <button class="message-action-btn" onclick="replyToMsg('${message.id}')">回复</button>
        ${isOwner ? `<button class="message-action-btn" onclick="editMessage('${message.id}')">编辑</button>` : ''}
        ${isOwner || isAdmin ? `<button class="message-action-btn" onclick="recallMessage('${message.id}')">撤回</button>` : ''}
        ${isAdmin ? `<button class="message-action-btn" onclick="pinMessage('${message.id}')">${message.pinned ? '取消置顶' : '置顶'}</button>` : ''}
      </div>
    `;
  }

  messageEl.innerHTML = `
    <img src="${message.avatar}" class="message-avatar" alt="${message.username}">
    <div class="message-content">
      <div class="message-header">
        <span class="message-username">${escapeHtml(message.username)}</span>
        <span class="message-time">${formatTime(message.timestamp)}</span>
        ${message.edited ? '<span class="message-edited">(已编辑)</span>' : ''}
      </div>
      ${replyHTML}
      ${contentHTML}
      ${actionsHTML}
    </div>
  `;

  // 点击消息显示/隐藏操作栏（移动端友好）
  messageEl.addEventListener('click', (e) => {
    if (e.target.closest('.message-action-btn')) return;
    const already = messageEl.classList.contains('show-actions');
    closeAllMessageActions();
    if (!already) messageEl.classList.add('show-actions');
  });

  messageEl.querySelectorAll('.message-action-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  });

  container.appendChild(messageEl);

  if (scroll) {
    scrollToBottom();
  }
}

function closeAllMessageActions() {
  document.querySelectorAll('.message.show-actions').forEach((el) => {
    el.classList.remove('show-actions');
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.message')) {
    closeAllMessageActions();
  }
});

function updateMessageInUI(message) {
  const messageEl = document.querySelector(`[data-message-id="${message.id}"]`);
  if (messageEl) {
    const contentEl = messageEl.querySelector('.message-text');
    if (contentEl) {
      contentEl.textContent = message.content;
    }

    // 添加已编辑标记
    const header = messageEl.querySelector('.message-header');
    if (!header.querySelector('.message-edited')) {
      const editedEl = document.createElement('span');
      editedEl.className = 'message-edited';
      editedEl.textContent = '(已编辑)';
      header.appendChild(editedEl);
    }
  }
}

function removeMessageFromUI(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.style.animation = 'fadeOut 0.3s ease';
    setTimeout(() => {
      messageEl.remove();
    }, 300);
  }
}

function updateMessagePinStatus(messageId, pinned) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    if (pinned) {
      messageEl.classList.add('pinned');
    } else {
      messageEl.classList.remove('pinned');
    }
  }
}

function findMessageById(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return null;

  return {
    id: messageId,
    username: messageEl.querySelector('.message-username')?.textContent || '',
    content: messageEl.querySelector('.message-text')?.textContent || '',
    type: messageEl.querySelector('.message-image') ? 'image' : 'text'
  };
}

function scrollToMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    messageEl.style.animation = 'highlight 1s ease';
    setTimeout(() => {
      messageEl.style.animation = '';
    }, 1000);
  }
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  if (container) {
    setTimeout(() => {
      container.scrollTop = container.scrollHeight;
    }, 100);
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============ 消息交互功能 ============

function replyToMsg(messageId) {
  const message = findMessageById(messageId);
  if (!message) return;

  replyToMessage = messageId;

  document.getElementById('reply-username').textContent = message.username;
  document.getElementById('reply-content').textContent =
    message.type === 'image' ? '图片' : (message.type === 'video' ? '视频' : message.content);
  document.getElementById('reply-preview').style.display = 'block';

  document.getElementById('message-input').focus();
}

document.getElementById('cancel-reply')?.addEventListener('click', () => {
  cancelReply();
});

function cancelReply() {
  replyToMessage = null;
  document.getElementById('reply-preview').style.display = 'none';
}

function editMessage(messageId) {
  const message = findMessageById(messageId);
  if (!message || message.type !== 'text') return;

  const newContent = prompt('编辑消息:', message.content);
  if (newContent && newContent.trim() && newContent !== message.content) {
    socket.emit('edit_message', {
      messageId,
      content: newContent.trim()
    });
  }
}

function recallMessage(messageId) {
  if (confirm('确定要撤回这条消息吗?')) {
    socket.emit('recall_message', { messageId });
  }
}

function pinMessage(messageId) {
  socket.emit('pin_message', { messageId });
}

// ============ 图片预览弹窗 ============
function openImageModal(url) {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('image-modal-img');
  img.src = url;
  modal.style.display = 'flex';
}

function closeImageModal() {
  const modal = document.getElementById('image-modal');
  const img = document.getElementById('image-modal-img');
  img.src = '';
  modal.style.display = 'none';
}

document.querySelector('#image-modal .image-modal-backdrop')?.addEventListener('click', closeImageModal);

// ============ 消息发送 ============

const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// 自动调整文本框高度
messageInput?.addEventListener('input', function() {
  this.style.height = 'auto';
  this.style.height = Math.min(this.scrollHeight, 120) + 'px';

  // 发送正在输入状态
  if (socket && currentGroupId) {
    socket.emit('typing', { groupId: currentGroupId });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stop_typing', { groupId: currentGroupId });
    }, 1000);
  }
});

// 发送消息 - 按钮点击
sendBtn?.addEventListener('click', () => {
  sendMessage();
});

// 发送消息 - 回车键
messageInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

function sendMessage() {
  const content = messageInput.value.trim();
  if ((!content && !pendingAttachment) || !socket || !currentGroupId) return;

  // 检查是否被禁言
  if (currentGroup?.muteAll && 
      currentGroup.ownerId !== currentUser.id && 
      !currentGroup.admins.includes(currentUser.id)) {
    showToast('当前群组已开启全员禁言', 'warning');
    return;
  }

  if (pendingAttachment) {
    uploadAndSendMedia(pendingAttachment.file, content);
  } else {
    const messageData = {
      groupId: currentGroupId,
      content,
      type: 'text',
      replyTo: replyToMessage
    };
    socket.emit('send_message', messageData);
  }

  messageInput.value = '';
  messageInput.style.height = 'auto';
  cancelReply();

  if (socket) {
    socket.emit('stop_typing', { groupId: currentGroupId });
  }
}

// ============ 图片/视频上传 ============

const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');

imageBtn?.addEventListener('click', () => {
  imageInput.click();
});

imageInput?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  setAttachment(file);
  imageInput.value = '';
});

// 粘贴图片
messageInput?.addEventListener('paste', async (e) => {
  const items = e.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      if (file) {
        setAttachment(file);
      }
      break;
    }
  }
});

function setAttachment(file) {
  if (!file) return;
  if (pendingAttachment?.file) {
    const shouldReplace = confirm('已存在待发送的附件，是否替换？');
    if (!shouldReplace) return;
  }
  clearAttachment();
  const url = URL.createObjectURL(file);
  const isVideo = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  pendingAttachment = { file, url, isVideo };

  const container = document.getElementById('attachment-preview');
  const media = document.getElementById('attachment-media');
  const name = document.getElementById('attachment-name');
  if (isVideo) {
    media.innerHTML = `<video src="${url}" muted></video>`;
  } else {
    media.innerHTML = `<img src="${url}" alt="预览">`;
  }
  name.textContent = file.name || (isVideo ? '视频' : '图片');
  container.style.display = 'block';
}

function clearAttachment() {
  if (pendingAttachment?.url) {
    URL.revokeObjectURL(pendingAttachment.url);
  }
  pendingAttachment = null;
  const container = document.getElementById('attachment-preview');
  const media = document.getElementById('attachment-media');
  const name = document.getElementById('attachment-name');
  if (container) container.style.display = 'none';
  if (media) media.innerHTML = '';
  if (name) name.textContent = '';
}

document.getElementById('cancel-attachment')?.addEventListener('click', () => {
  clearAttachment();
});

async function uploadAndSendMedia(file, captionText = '') {
  if (!socket || !currentGroupId) return;

  const isVideo = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
  const maxBytes = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast(isVideo ? '视频大小不能超过 20MB' : '图片大小不能超过 5MB', 'error');
    return;
  }

  try {
    const uploadFile = isVideo ? file : await compressImage(file);

    // 上传文件
    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('groupId', currentGroupId);

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('上传失败');
    }

    const data = await response.json();

    // 发送媒体消息
    socket.emit('send_message', {
      groupId: currentGroupId,
      type: isVideo ? 'video' : 'image',
      imageUrl: data.url,
      content: captionText || (isVideo ? '[视频]' : '[图片]'),
      replyTo: replyToMessage
    });

    clearAttachment();
    cancelReply();
  } catch (error) {
    console.error('上传失败:', error);
    showToast('上传失败', 'error');
  }
}

async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // 最大宽度/高度
        const maxSize = 1920;
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = (height / width) * maxSize;
            width = maxSize;
          } else {
            width = (width / height) * maxSize;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.8);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ============ Emoji 选择器 ============

const emojiBtn = document.getElementById('emoji-btn');
const emojiPicker = document.getElementById('emoji-picker');

emojiBtn?.addEventListener('click', (e) => {
  e.stopPropagation();
  emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
});

// 点击 emoji
emojiPicker?.addEventListener('click', (e) => {
  if (e.target.tagName === 'SPAN') {
    const emoji = e.target.textContent.trim();
    if (emoji) {
      messageInput.value += emoji;
      messageInput.focus();
    }
  }
});

// 点击外部关闭 emoji 选择器
document.addEventListener('click', (e) => {
  if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
    emojiPicker.style.display = 'none';
  }
});

// ============ 侧边栏移动端切换 ============
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebarEl = document.querySelector('.sidebar');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const panelBackdrop = document.getElementById('panel-backdrop');
const mobileTabbar = document.getElementById('mobile-tabbar');
const appPageEl = document.getElementById('app-page');

function syncMobileTabbar() {
  if (!mobileTabbar) return;
  const isAppVisible = appPageEl && appPageEl.style.display !== 'none';
  if (isAppVisible && window.innerWidth <= 768) {
    mobileTabbar.style.display = 'flex';
  } else {
    mobileTabbar.style.display = 'none';
  }
}

function openSidebar() {
  sidebarEl?.classList.add('open');
  if (sidebarBackdrop) sidebarBackdrop.style.display = 'block';
}

function closeSidebar() {
  sidebarEl?.classList.remove('open');
  if (sidebarBackdrop) sidebarBackdrop.style.display = 'none';
}

sidebarToggle?.addEventListener('click', () => {
  if (sidebarEl?.classList.contains('open')) closeSidebar();
  else openSidebar();
});

sidebarBackdrop?.addEventListener('click', closeSidebar);

// 移动端底部按钮
document.getElementById('tab-groups')?.addEventListener('click', () => {
  openSidebar();
});
document.getElementById('tab-create')?.addEventListener('click', () => {
  openModal('create-group-modal');
});
document.getElementById('tab-join')?.addEventListener('click', () => {
  openModal('join-group-modal');
});
document.getElementById('tab-info')?.addEventListener('click', () => {
  if (!currentGroupId) {
    showToast('请先选择群组', 'info');
    return;
  }
  const panel = document.getElementById('right-panel');
  const next = panel.style.display === 'none' ? 'flex' : 'none';
  panel.style.display = next;
  if (panelBackdrop) panelBackdrop.style.display = next === 'flex' ? 'block' : 'none';
});

window.addEventListener('resize', syncMobileTabbar);

// ============ 正在输入指示器 ============

function showTypingIndicator(username) {
  const indicator = document.getElementById('typing-indicator');
  const usernameEl = document.getElementById('typing-username');
  
  usernameEl.textContent = username;
  indicator.style.display = 'flex';
  scrollToBottom();
}

function hideTypingIndicator() {
  const indicator = document.getElementById('typing-indicator');
  indicator.style.display = 'none';
}

// ============ 公告和置顶消息 ============

function updateAnnouncement(announcement) {
  const banner = document.getElementById('announcement-banner');
  const text = document.getElementById('announcement-text');

  if (announcement && announcement.trim()) {
    text.textContent = announcement;
    banner.style.display = 'flex';
  } else {
    banner.style.display = 'none';
  }
}

function updatePinnedMessages(pinnedMessageIds) {
  const banner = document.getElementById('pinned-messages-banner');
  const content = document.getElementById('pinned-messages-content');

  if (pinnedMessageIds && pinnedMessageIds.length > 0) {
    const messages = pinnedMessageIds.map(id => findMessageById(id)).filter(Boolean);
    if (messages.length > 0) {
      const text = messages.map(m => `${m.username}: ${m.type === 'image' ? '[图片]' : (m.type === 'video' ? '[视频]' : m.content)}`).join(' | ');
      content.textContent = text;
      banner.style.display = 'flex';
      
      // 点击跳转到第一条置顶消息
      banner.onclick = () => scrollToMessage(pinnedMessageIds[0]);
      attachPinnedLongPress(banner, pinnedMessageIds[0]);
      return;
    }
  }

  banner.style.display = 'none';
}

function attachPinnedLongPress(bannerEl, messageId) {
  if (!bannerEl) return;
  const isAdmin = currentGroup && (currentGroup.ownerId === currentUser?.id || currentGroup.admins.includes(currentUser?.id));
  if (!isAdmin) return;

  let pressTimer = null;
  const start = () => {
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => {
      if (confirm('取消置顶这条消息？')) {
        socket?.emit('pin_message', { messageId });
      }
    }, 600);
  };
  const cancel = () => {
    clearTimeout(pressTimer);
  };

  bannerEl.onpointerdown = start;
  bannerEl.onpointerup = cancel;
  bannerEl.onpointerleave = cancel;
  bannerEl.onpointercancel = cancel;
}

// ============ 右侧面板 ============

function updateGroupPanel(group) {
  // 群组详情
  document.getElementById('detail-group-id').textContent = group.id;
  document.getElementById('detail-created-at').textContent = new Date(group.createdAt).toLocaleDateString('zh-CN');
  document.getElementById('detail-description').textContent = group.description || '暂无描述';

  // 管理员操作
  const isAdmin = currentUser && (group.ownerId === currentUser.id || group.admins.includes(currentUser.id));
  const adminActions = document.getElementById('admin-actions');
  if (isAdmin) {
    adminActions.style.display = 'block';
    document.getElementById('mute-all-text').textContent = group.muteAll ? '关闭全员禁言' : '开启全员禁言';
  } else {
    adminActions.style.display = 'none';
  }

  // 成员列表
  displayMembers(group.membersInfo || []);
}

function displayMembers(members) {
  const container = document.getElementById('members-list');
  const countEl = document.getElementById('members-count');
  
  countEl.textContent = members.length;
  container.innerHTML = '';

  members.forEach(member => {
    const memberEl = document.createElement('div');
    memberEl.className = 'member-item';
    memberEl.dataset.userId = member.id;

    let roleText = '';
    if (currentGroup.ownerId === member.id) {
      roleText = '群主';
    } else if (currentGroup.admins.includes(member.id)) {
      roleText = '管理员';
    }

    const isOwner = currentUser && currentGroup.ownerId === currentUser.id;
    const canManageAdmin = isOwner && member.id !== currentGroup.ownerId;
    const isMemberAdmin = currentGroup.admins.includes(member.id);

    memberEl.innerHTML = `
      <img src="${member.avatar}" class="member-avatar" alt="${member.username}">
      <div class="member-info">
        <div class="member-name">${escapeHtml(member.username)}</div>
        ${roleText ? `<div class="member-role">${roleText}</div>` : ''}
      </div>
      ${canManageAdmin ? `<button class="member-action-btn" data-action="toggle-admin">${isMemberAdmin ? '取消管理员' : '设为管理员'}</button>` : ''}
      <div class="member-status ${member.isOnline ? 'online' : ''}"></div>
    `;

    if (canManageAdmin) {
      memberEl.querySelector('[data-action="toggle-admin"]')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const action = isMemberAdmin ? 'remove' : 'add';
          const label = isMemberAdmin ? '取消管理员' : '设为管理员';
          if (!confirm(`确定要${label}：${member.username} 吗？`)) return;

          await apiRequest(`/api/groups/${currentGroup.id}/admins`, {
            method: 'PUT',
            body: JSON.stringify({ userId: member.id, action })
          });
          await loadGroupDetails(currentGroup.id);
          showToast('操作成功', 'success');
        } catch (err) {
          showToast(err.message || '操作失败', 'error');
        }
      });
    }

    container.appendChild(memberEl);
  });
}

function updateMemberOnlineStatus(userId, isOnline) {
  const memberEl = document.querySelector(`[data-user-id="${userId}"]`);
  if (memberEl) {
    const statusEl = memberEl.querySelector('.member-status');
    if (isOnline) {
      statusEl.classList.add('online');
    } else {
      statusEl.classList.remove('online');
    }
  }
}

function updateMuteAllUI() {
  if (!currentGroup) return;
  document.getElementById('mute-all-text').textContent = 
    currentGroup.muteAll ? '关闭全员禁言' : '开启全员禁言';
}

// 打开/关闭群组信息面板
document.getElementById('group-info-btn')?.addEventListener('click', () => {
  const panel = document.getElementById('right-panel');
  const next = panel.style.display === 'none' ? 'flex' : 'none';
  panel.style.display = next;
  if (panelBackdrop) panelBackdrop.style.display = next === 'flex' ? 'block' : 'none';
});

document.getElementById('close-panel')?.addEventListener('click', () => {
  document.getElementById('right-panel').style.display = 'none';
  if (panelBackdrop) panelBackdrop.style.display = 'none';
});

panelBackdrop?.addEventListener('click', () => {
  document.getElementById('right-panel').style.display = 'none';
  if (panelBackdrop) panelBackdrop.style.display = 'none';
});

// ============ 模态框 ============

function openModal(modalId) {
  document.getElementById('modal-overlay').style.display = 'flex';
  document.getElementById(modalId).style.display = 'block';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
}

// 点击遮罩层关闭
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') {
    closeModal();
  }
});

// ============ 创建群组 ============

document.getElementById('create-group-btn')?.addEventListener('click', () => {
  openModal('create-group-modal');
});

document.getElementById('create-group-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const name = document.getElementById('new-group-name').value.trim();
  const description = document.getElementById('new-group-description').value.trim();

  try {
    const group = await apiRequest('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name, description })
    });

    closeModal();
    document.getElementById('create-group-form').reset();

    await loadGroups();
    selectGroup(group.id);

    showToast('群组创建成功!', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ============ 加入群组 ============

document.getElementById('join-group-btn')?.addEventListener('click', () => {
  openModal('join-group-modal');
});

let searchedGroup = null;

document.getElementById('search-group-btn')?.addEventListener('click', async () => {
  const groupId = document.getElementById('join-group-id').value.trim();

  if (!groupId || groupId.length !== 7) {
    showToast('请输入7位数字群组ID', 'error');
    return;
  }

  try {
    const group = await apiRequest(`/api/groups/search/${groupId}`);
    searchedGroup = group;

    document.getElementById('preview-group-name').textContent = group.name;
    document.getElementById('preview-group-description').textContent = group.description || '暂无描述';
    document.getElementById('preview-member-count').textContent = group.memberCount;

    document.getElementById('group-preview').style.display = 'block';
    document.getElementById('join-group-submit-btn').style.display = 'block';
  } catch (error) {
    showToast(error.message, 'error');
    document.getElementById('group-preview').style.display = 'none';
    document.getElementById('join-group-submit-btn').style.display = 'none';
  }
});

document.getElementById('join-group-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!searchedGroup) {
    showToast('请先搜索群组', 'error');
    return;
  }

  try {
    await apiRequest(`/api/groups/${searchedGroup.id}/join`, {
      method: 'POST'
    });

    closeModal();
    document.getElementById('join-group-form').reset();
    document.getElementById('group-preview').style.display = 'none';
    document.getElementById('join-group-submit-btn').style.display = 'none';
    searchedGroup = null;

    await loadGroups();
    showToast('加入群组成功!', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ============ 编辑群公告 ============

document.getElementById('edit-announcement-btn')?.addEventListener('click', () => {
  document.getElementById('announcement-input').value = currentGroup?.announcement || '';
  openModal('edit-announcement-modal');
});

document.getElementById('edit-announcement-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const announcement = document.getElementById('announcement-input').value.trim();

  try {
    await apiRequest(`/api/groups/${currentGroupId}/announcement`, {
      method: 'PUT',
      body: JSON.stringify({ announcement })
    });

    closeModal();
    showToast('公告已更新', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ============ 全员禁言 ============

document.getElementById('toggle-mute-all-btn')?.addEventListener('click', async () => {
  if (!currentGroup) return;

  const newMuteAll = !currentGroup.muteAll;

  try {
    await apiRequest(`/api/groups/${currentGroupId}/mute-all`, {
      method: 'PUT',
      body: JSON.stringify({ muteAll: newMuteAll })
    });

    showToast(newMuteAll ? '已开启全员禁言' : '已关闭全员禁言', 'success');
  } catch (error) {
    showToast(error.message, 'error');
  }
});

// ============ 多标签页同步 ============

window.addEventListener('storage', (e) => {
  if (e.key === 'token') {
    if (!e.newValue && currentUser) {
      // Token 被删除,退出登录
      logout();
    } else if (e.newValue && !currentUser) {
      // 新的 Token,重新加载
      location.reload();
    }
  }
});

// ============ 初始化 ============

async function init() {
  const token = getToken();
  const user = getUser();

  if (token && user) {
    try {
      // 验证 token 是否有效
      const userData = await apiRequest('/api/user/me');
      currentUser = userData;
      setUser(userData);

      // 显示头像和用户名
      document.getElementById('current-user-avatar').src = userData.avatar;
      document.getElementById('current-username').textContent = userData.username;

      connectSocket();
      showPage('app-page');
      await loadGroups();
    } catch (error) {
      console.error('初始化失败:', error);
      logout();
    }
  } else {
    showPage('auth-page');
  }
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
