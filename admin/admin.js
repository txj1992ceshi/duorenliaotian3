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

function formatBytes(value) {
  if (value === null || value === undefined) return '-';
  const num = Number(value);
  if (Number.isNaN(num)) return '-';
  if (num === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(num) / Math.log(1024)), units.length - 1);
  const v = num / (1024 ** idx);
  return `${v.toFixed(v >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatUsageLine(used, limit) {
  if (used == null && limit == null) return '-';
  if (limit == null) return `${formatBytes(used)} / -`;
  const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : null;
  return `${formatBytes(used)} / ${formatBytes(limit)}${percent != null ? ` (${percent}%)` : ''}`;
}

async function loadStats() {
  const data = await api('/api/admin/stats');
  document.getElementById('stat-users').textContent = data.usersCount ?? '-';
  document.getElementById('stat-groups').textContent = data.groupsCount ?? '-';
  document.getElementById('stat-messages').textContent = data.messagesCount ?? '-';
  document.getElementById('stat-online').textContent = data.onlineCount ?? '-';
  const cloudinaryEl = document.getElementById('stat-cloudinary');
  if (cloudinaryEl) {
    const usage = data.cloudinary || null;
    if (!usage || usage.error) {
      cloudinaryEl.textContent = usage?.error ? '不可用' : '-';
    } else {
      const storage = formatUsageLine(usage.storageUsedBytes, usage.storageLimitBytes);
      const credits = usage.creditsLimit != null
        ? `${usage.creditsUsed ?? 0} / ${usage.creditsLimit}`
        : (usage.creditsUsed != null ? String(usage.creditsUsed) : '-');
      cloudinaryEl.innerHTML = `
        <div style="font-size:12px;color:var(--muted);margin-bottom:4px;">存储</div>
        <div>${storage}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:6px;">额度</div>
        <div>${credits}</div>
      `;
    }
  }
}

async function loadUsers() {
  const users = await api('/api/admin/users');
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    const statusText = u.isBanned ? '已封禁' : '正常';
    const statusClass = u.isBanned ? 'badge badge-danger' : 'badge badge-ok';
    const actionText = u.isBanned ? '解封' : '封禁';
    tr.innerHTML = `
      <td data-label="用户名">${u.username || '-'}</td>
      <td data-label="邮箱">${u.email || '-'}</td>
      <td data-label="注册时间">${formatDate(u.createdAt)}</td>
      <td data-label="上次登录">${formatDate(u.lastLoginAt)}</td>
      <td data-label="未登录天数">${u.daysSinceLastLogin ?? '-'}</td>
      <td data-label="状态"><span class="${statusClass}">${statusText}</span></td>
      <td data-label="操作">
        <div class="action-row">
          <input class="input" type="password" placeholder="新密码" />
          <button class="btn-small">改密码</button>
          <button class="btn-small btn-ghost" data-action="toggle-ban">${actionText}</button>
        </div>
      </td>
    `;
    const input = tr.querySelector('input');
    const btn = tr.querySelector('button');
    const banBtn = tr.querySelector('[data-action="toggle-ban"]');
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
    banBtn.addEventListener('click', async () => {
      const next = !u.isBanned;
      const label = next ? '封禁' : '解封';
      if (!confirm(`确定要${label}该用户吗？`)) return;
      await api(`/api/admin/users/${u.id}/ban`, {
        method: 'PUT',
        body: JSON.stringify({ banned: next })
      });
      refreshAll().catch((e) => alert(e.message));
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
