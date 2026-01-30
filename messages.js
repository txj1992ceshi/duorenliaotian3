const express = require('express');
const router = express.Router();
const db = require('../database');

// 发送消息
router.post('/', async (req, res) => {
    try {
        const { groupId, content, type, replyTo } = req.body;

        if (!groupId || !content) {
            return res.status(400).json({
                success: false,
                message: '群组ID和消息内容不能为空'
            });
        }

        // 检查用户是否是群组成员
        const membership = await db.get(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, req.user.id]
        );

        if (!membership) {
            return res.status(403).json({
                success: false,
                message: '您不是该群组成员'
            });
        }

        // 检查全员禁言
        const group = await db.get('SELECT mute_all FROM groups WHERE id = ?', [groupId]);
        if (group && group.mute_all === 1) {
            if (membership.role !== 'owner' && membership.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: '该群组已开启全员禁言'
                });
            }
        }

        // 插入消息
        const result = await db.run(`
            INSERT INTO messages (group_id, user_id, content, type, reply_to)
            VALUES (?, ?, ?, ?, ?)
        `, [groupId, req.user.id, content, type || 'text', replyTo || null]);

        // 获取完整的消息信息
        const message = await db.get(`
            SELECT m.*, u.username,
                   rm.content as reply_to_content,
                   ru.username as reply_to_username
            FROM messages m
            INNER JOIN users u ON m.user_id = u.id
            LEFT JOIN messages rm ON m.reply_to = rm.id
            LEFT JOIN users ru ON rm.user_id = ru.id
            WHERE m.id = ?
        `, [result.id]);

        res.json({
            success: true,
            message: {
                id: message.id,
                groupId: message.group_id,
                userId: message.user_id,
                username: message.username,
                content: message.content,
                type: message.type,
                edited: false,
                createdAt: message.created_at,
                replyTo: message.reply_to ? {
                    id: message.reply_to,
                    content: message.reply_to_content,
                    username: message.reply_to_username
                } : null
            }
        });
    } catch (error) {
        console.error('发送消息错误:', error);
        res.status(500).json({
            success: false,
            message: '发送消息失败'
        });
    }
});

// 编辑消息
router.put('/:id', async (req, res) => {
    try {
        const messageId = req.params.id;
        const { content } = req.body;

        if (!content) {
            return res.status(400).json({
                success: false,
                message: '消息内容不能为空'
            });
        }

        // 检查消息是否存在且属于当前用户
        const message = await db.get(
            'SELECT * FROM messages WHERE id = ? AND user_id = ?',
            [messageId, req.user.id]
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: '消息不存在或无权编辑'
            });
        }

        // 更新消息
        await db.run(`
            UPDATE messages 
            SET content = ?, edited = 1, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        `, [content, messageId]);

        res.json({
            success: true,
            message: '消息已编辑'
        });
    } catch (error) {
        console.error('编辑消息错误:', error);
        res.status(500).json({
            success: false,
            message: '编辑消息失败'
        });
    }
});

// 删除消息
router.delete('/:id', async (req, res) => {
    try {
        const messageId = req.params.id;

        // 检查消息是否存在
        const message = await db.get(
            'SELECT * FROM messages WHERE id = ?',
            [messageId]
        );

        if (!message) {
            return res.status(404).json({
                success: false,
                message: '消息不存在'
            });
        }

        // 检查权限（消息发送者或管理员可以删除）
        const membership = await db.get(
            'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
            [message.group_id, req.user.id]
        );

        const canDelete = message.user_id === req.user.id || 
                         membership.role === 'owner' || 
                         membership.role === 'admin';

        if (!canDelete) {
            return res.status(403).json({
                success: false,
                message: '没有权限删除该消息'
            });
        }

        // 删除消息
        await db.run('DELETE FROM messages WHERE id = ?', [messageId]);

        res.json({
            success: true,
            message: '消息已删除'
        });
    } catch (error) {
        console.error('删除消息错误:', error);
        res.status(500).json({
            success: false,
            message: '删除消息失败'
        });
    }
});

module.exports = router;
