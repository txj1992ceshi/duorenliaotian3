const express = require('express');
const router = express.Router();
const db = require('../database');

// 生成7位数字群组ID
function generateGroupId() {
    return Math.floor(1000000 + Math.random() * 9000000).toString();
}

// 获取用户的群组列表
router.get('/', async (req, res) => {
    try {
        const groups = await db.query(`
            SELECT DISTINCT g.*, u.username as owner_name,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM groups g
            INNER JOIN group_members gm ON g.id = gm.group_id
            INNER JOIN users u ON g.owner_id = u.id
            WHERE gm.user_id = ?
            ORDER BY g.created_at DESC
        `, [req.user.id]);

        res.json({
            success: true,
            groups
        });
    } catch (error) {
        console.error('获取群组列表错误:', error);
        res.status(500).json({
            success: false,
            message: '获取群组列表失败'
        });
    }
});

// 创建群组
router.post('/', async (req, res) => {
    try {
        const { name, description } = req.body;

        if (!name || name.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: '群组名称不能为空'
            });
        }

        // 生成唯一的群组ID
        let groupId = generateGroupId();
        let existing = await db.get('SELECT id FROM groups WHERE id = ?', [groupId]);
        
        while (existing) {
            groupId = generateGroupId();
            existing = await db.get('SELECT id FROM groups WHERE id = ?', [groupId]);
        }

        // 创建群组
        await db.run(`
            INSERT INTO groups (id, name, description, owner_id)
            VALUES (?, ?, ?, ?)
        `, [groupId, name.trim(), description?.trim() || '', req.user.id]);

        // 添加创建者为群主
        await db.run(`
            INSERT INTO group_members (group_id, user_id, role)
            VALUES (?, ?, 'owner')
        `, [groupId, req.user.id]);

        // 获取创建的群组信息
        const group = await db.get(`
            SELECT g.*, u.username as owner_name,
                   1 as member_count
            FROM groups g
            INNER JOIN users u ON g.owner_id = u.id
            WHERE g.id = ?
        `, [groupId]);

        res.json({
            success: true,
            message: '群组创建成功',
            group
        });
    } catch (error) {
        console.error('创建群组错误:', error);
        res.status(500).json({
            success: false,
            message: '创建群组失败'
        });
    }
});

// 加入群组
router.post('/join', async (req, res) => {
    try {
        const { groupId } = req.body;

        if (!groupId) {
            return res.status(400).json({
                success: false,
                message: '群组ID不能为空'
            });
        }

        // 检查群组是否存在
        const group = await db.get('SELECT * FROM groups WHERE id = ?', [groupId]);
        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }

        // 检查是否已加入
        const existing = await db.get(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (existing) {
            return res.status(400).json({
                success: false,
                message: '您已经是该群组成员'
            });
        }

        // 加入群组
        await db.run(
            'INSERT INTO group_members (group_id, user_id, role) VALUES (?, ?, ?)',
            [groupId, req.user.id, 'member']
        );

        // 获取群组信息
        const groupInfo = await db.get(`
            SELECT g.*, u.username as owner_name,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM groups g
            INNER JOIN users u ON g.owner_id = u.id
            WHERE g.id = ?
        `, [groupId]);

        res.json({
            success: true,
            message: '加入群组成功',
            group: groupInfo
        });
    } catch (error) {
        console.error('加入群组错误:', error);
        res.status(500).json({
            success: false,
            message: '加入群组失败'
        });
    }
});

// 获取群组详情
router.get('/:id', async (req, res) => {
    try {
        const groupId = req.params.id;

        // 检查用户是否是群组成员
        const membership = await db.get(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: '您不是该群组成员'
            });
        }

        // 获取群组详情
        const group = await db.get(`
            SELECT g.*, u.username as owner_name,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM groups g
            INNER JOIN users u ON g.owner_id = u.id
            WHERE g.id = ?
        `, [groupId]);

        if (!group) {
            return res.status(404).json({
                success: false,
                message: '群组不存在'
            });
        }

        res.json({
            success: true,
            group
        });
    } catch (error) {
        console.error('获取群组详情错误:', error);
        res.status(500).json({
            success: false,
            message: '获取群组详情失败'
        });
    }
});

// 获取群组成员
router.get('/:id/members', async (req, res) => {
    try {
        const groupId = req.params.id;

        // 检查用户是否是群组成员
        const membership = await db.get(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: '您不是该群组成员'
            });
        }

        // 获取成员列表
        const members = await db.query(`
            SELECT u.id, u.username, gm.role, gm.joined_at,
                   0 as online
            FROM group_members gm
            INNER JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY 
                CASE gm.role 
                    WHEN 'owner' THEN 1 
                    WHEN 'admin' THEN 2 
                    ELSE 3 
                END,
                gm.joined_at ASC
        `, [groupId]);

        res.json({
            success: true,
            members
        });
    } catch (error) {
        console.error('获取群组成员错误:', error);
        res.status(500).json({
            success: false,
            message: '获取群组成员失败'
        });
    }
});

// 获取历史消息
router.get('/:id/messages', async (req, res) => {
    try {
        const groupId = req.params.id;
        const limit = parseInt(req.query.limit) || 50;
        const before = req.query.before;

        // 检查用户是否是群组成员
        const membership = await db.get(
            'SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: '您不是该群组成员'
            });
        }

        let query = `
            SELECT m.*, u.username,
                   rm.content as reply_to_content,
                   ru.username as reply_to_username
            FROM messages m
            INNER JOIN users u ON m.user_id = u.id
            LEFT JOIN messages rm ON m.reply_to = rm.id
            LEFT JOIN users ru ON rm.user_id = ru.id
            WHERE m.group_id = ?
        `;

        const params = [groupId];

        if (before) {
            query += ' AND m.id < ?';
            params.push(before);
        }

        query += ' ORDER BY m.created_at DESC LIMIT ?';
        params.push(limit);

        let messages = await db.query(query, params);
        
        // 反转数组以按时间正序排列
        messages.reverse();

        // 格式化消息
        messages = messages.map(msg => ({
            id: msg.id,
            groupId: msg.group_id,
            userId: msg.user_id,
            username: msg.username,
            content: msg.content,
            type: msg.type,
            edited: msg.edited === 1,
            createdAt: msg.created_at,
            updatedAt: msg.updated_at,
            replyTo: msg.reply_to ? {
                id: msg.reply_to,
                content: msg.reply_to_content,
                username: msg.reply_to_username
            } : null
        }));

        res.json({
            success: true,
            messages
        });
    } catch (error) {
        console.error('获取历史消息错误:', error);
        res.status(500).json({
            success: false,
            message: '获取历史消息失败'
        });
    }
});

// 设置群公告
router.put('/:id/announcement', async (req, res) => {
    try {
        const groupId = req.params.id;
        const { announcement } = req.body;

        // 检查权限（只有群主和管理员可以设置）
        const membership = await db.get(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: '没有权限'
            });
        }

        await db.run(
            'UPDATE groups SET announcement = ? WHERE id = ?',
            [announcement || '', groupId]
        );

        res.json({
            success: true,
            message: '群公告已更新'
        });
    } catch (error) {
        console.error('设置群公告错误:', error);
        res.status(500).json({
            success: false,
            message: '设置群公告失败'
        });
    }
});

// 设置全员禁言
router.put('/:id/mute-all', async (req, res) => {
    try {
        const groupId = req.params.id;
        const { mute } = req.body;

        // 检查权限
        const membership = await db.get(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: '没有权限'
            });
        }

        await db.run(
            'UPDATE groups SET mute_all = ? WHERE id = ?',
            [mute ? 1 : 0, groupId]
        );

        res.json({
            success: true,
            message: mute ? '已开启全员禁言' : '已关闭全员禁言'
        });
    } catch (error) {
        console.error('设置全员禁言错误:', error);
        res.status(500).json({
            success: false,
            message: '设置全员禁言失败'
        });
    }
});

// 置顶消息
router.put('/:id/pin', async (req, res) => {
    try {
        const groupId = req.params.id;
        const { messageId } = req.body;

        // 检查权限
        const membership = await db.get(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: '没有权限'
            });
        }

        await db.run(
            'UPDATE groups SET pinned_message_id = ? WHERE id = ?',
            [messageId, groupId]
        );

        res.json({
            success: true,
            message: '消息已置顶'
        });
    } catch (error) {
        console.error('置顶消息错误:', error);
        res.status(500).json({
            success: false,
            message: '置顶消息失败'
        });
    }
});

// 取消置顶
router.delete('/:id/pin', async (req, res) => {
    try {
        const groupId = req.params.id;

        // 检查权限
        const membership = await db.get(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership || (membership.role !== 'owner' && membership.role !== 'admin')) {
            return res.status(403).json({
                success: false,
                message: '没有权限'
            });
        }

        await db.run(
            'UPDATE groups SET pinned_message_id = NULL WHERE id = ?',
            [groupId]
        );

        res.json({
            success: true,
            message: '已取消置顶'
        });
    } catch (error) {
        console.error('取消置顶错误:', error);
        res.status(500).json({
            success: false,
            message: '取消置顶失败'
        });
    }
});

// 退出群组
router.post('/:id/leave', async (req, res) => {
    try {
        const groupId = req.params.id;

        // 检查是否是群主
        const group = await db.get('SELECT owner_id FROM groups WHERE id = ?', [groupId]);
        if (group && group.owner_id === req.user.id) {
            return res.status(400).json({
                success: false,
                message: '群主不能退出群组'
            });
        }

        await db.run(
            'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        res.json({
            success: true,
            message: '已退出群组'
        });
    } catch (error) {
        console.error('退出群组错误:', error);
        res.status(500).json({
            success: false,
            message: '退出群组失败'
        });
    }
});

module.exports = router;
