const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 确保上传目录存在
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 配置 multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        // 只允许图片
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('只支持图片文件 (jpeg, jpg, png, gif, webp)'));
        }
    }
});

// 上传图片
router.post('/image', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '没有上传文件'
            });
        }

        // 返回图片 URL
        const imageUrl = `/uploads/${req.file.filename}`;

        res.json({
            success: true,
            message: '上传成功',
            url: imageUrl,
            filename: req.file.filename,
            size: req.file.size
        });
    } catch (error) {
        console.error('上传图片错误:', error);
        res.status(500).json({
            success: false,
            message: '上传失败'
        });
    }
});

// 错误处理
router.use((error, req, res, next) => {
    if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                success: false,
                message: '文件大小超过限制 (最大 5MB)'
            });
        }
    }
    
    res.status(500).json({
        success: false,
        message: error.message || '上传失败'
    });
});

module.exports = router;
