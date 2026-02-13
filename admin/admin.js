let authHeader = null;

function getAuthHeader() {
  if (authHeader) return authHeader;
  const user = window.prompt('管理员账号：', 'tt555666');
  if (user === null) return null;
  const pass = window.prompt('管理员密码：', '');
  if (pass === null) return null;
  authHeader = 'Basic ' + btoa(`${user}:${pass}`);
  return authHeader;
}

async function api(path, options = {}) {
  const header = getAuthHeader();
  if (!header) throw new Error('未登录');
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: header,
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || '请求失败');
  }
  return res.json();
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN');
}

async function loadStats() {
  const data = await api('/api/admin/stats');
  document.getElementById('stat-users').textContent = data.usersCount ?? '-';
  document.getElementById('stat-groups').textContent = data.groupsCount ?? '-';
  document.getElementById('stat-messages').textContent = data.messagesCount ?? '-';
  document.getElementById('stat-online').textContent = data.onlineCount ?? '-';
}

async function loadUsers() {
  const users = await api('/api/admin/users');
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${u.username || '-'}</td>
      <td>${u.email || '-'}</td>
      <td>${formatDate(u.createdAt)}</td>
      <td>${formatDate(u.lastLoginAt)}</td>
      <td>${u.daysSinceLastLogin ?? '-'}</td>
      <td>
        <div class="action-row">
          <input class="input" type="password" placeholder="新密码" />
          <button class="btn-small">改密码</button>
        </div>
      </td>
    `;
    const input = tr.querySelector('input');
    const btn = tr.querySelector('button');
    btn.addEventListener('click', async () => {
      const newPassword = input.value.trim();
      if (!newPassword || newPassword.length < 6) {
        alert('新密码至少 6 位');
        return;
      }
      await api(`/api/admin/users/${u.id}/password`, {
        method: 'PUT',
        body: JSON.stringify({ newPassword })
      });
      input.value = '';
      alert('密码已更新');
    });
    tbody.appendChild(tr);
  });
}

async function refreshAll() {
  await Promise.all([loadStats(), loadUsers()]);
}

document.getElementById('refresh-btn').addEventListener('click', () => {
  refreshAll().catch((e) => alert(e.message));
});

document.getElementById('logout-btn').addEventListener('click', () => {
  authHeader = null;
  location.reload();
});

refreshAll().catch((e) => alert(e.message));
