const fs = require('fs').promises;
const path = require('path');
const { IncomingForm } = require('formidable');

class UploadHandler {
    constructor() {
        this.uploadDir = path.join(__dirname, '../uploads');
        this.maxFileSize = 10 * 1024 * 1024; // 10MB
        this.allowedTypes = [
            'image/jpeg',
            'image/png', 
            'image/gif',
            'application/pdf',
            'text/plain'
        ];
        this.allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.txt'];
        
        this.ensureUploadDir();
    }

    async ensureUploadDir() {
        try {
            await fs.mkdir(this.uploadDir, { recursive: true });
            console.log(`📁 Upload directory ready: ${this.uploadDir}`);
        } catch (error) {
            console.error('Error creating upload directory:', error);
        }
    }

    validateFile(file) {
        if (!file) {
            throw new Error('No file uploaded');
        }

        // Check file type
        if (!this.allowedTypes.includes(file.mimetype)) {
            throw new Error(`File type "${file.mimetype}" not allowed. Allowed: ${this.allowedTypes.join(', ')}`);
        }

        // Check file size
        if (file.size > this.maxFileSize) {
            const maxSizeMB = this.maxFileSize / 1024 / 1024;
            const fileSizeMB = (file.size / 1024 / 1024).toFixed(2);
            throw new Error(`File size ${fileSizeMB}MB exceeds limit of ${maxSizeMB}MB`);
        }

        // Check file extension
        const ext = path.extname(file.originalFilename).toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
            throw new Error(`File extension "${ext}" not allowed. Allowed: ${this.allowedExtensions.join(', ')}`);
        }

        return true;
    }

    sanitizeFilename(filename) {
        // Remove path traversal attempts
        let sanitized = filename.replace(/\.\.\//g, '');
        sanitized = sanitized.replace(/\.\.\\/g, '');
        
        // Remove null bytes
        sanitized = sanitized.replace(/\0/g, '');
        
        // Remove control characters
        sanitized = sanitized.replace(/[\0-\x1F\x7F]/g, '');
        
        // Keep only safe characters
        sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');
        
        // Limit length
        if (sanitized.length > 255) {
            const extIndex = sanitized.lastIndexOf('.');
            if (extIndex > 0) {
                const name = sanitized.substring(0, extIndex);
                const ext = sanitized.substring(extIndex);
                sanitized = name.substring(0, 255 - ext.length) + ext;
            } else {
                sanitized = sanitized.substring(0, 255);
            }
        }
        
        return sanitized;
    }

    generateUniqueFilename(originalName) {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        const ext = path.extname(originalName);
        const basename = path.basename(originalName, ext).replace(/[^a-zA-Z0-9-_]/g, '_');
        return `${basename}_${timestamp}_${random}${ext}`;
    }

    // Move file with locking to prevent race conditions
    async moveFileWithLock(sourcePath, destPath) {
        const lockFile = destPath + '.lock';
        let lockHandle;
        
        try {
            // Create lock file
            lockHandle = await fs.open(lockFile, 'wx');
            
            // Move file
            await fs.rename(sourcePath, destPath);
        } catch (error) {
            if (error.code === 'EEXIST') {
                // Lock file exists, wait and retry
                await new Promise(resolve => setTimeout(resolve, 100));
                return this.moveFileWithLock(sourcePath, destPath);
            }
            throw error;
        } finally {
            // Remove lock file
            if (lockHandle) {
                await lockHandle.close();
            }
            try {
                await fs.unlink(lockFile);
            } catch (unlinkError) {
                // Ignore lock file removal errors
            }
        }
    }

    sendSuccessResponse(res, req, fileInfo) {
        const response = {
            success: true,
            message: 'File uploaded successfully',
            file: {
                ...fileInfo,
                url: `http://${req.headers.host}/uploads/${fileInfo.filename}`
            }
        };

        res.writeHead(200, {
            'Content-Type': 'application/json; charset=UTF-8',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify(response, null, 2));
    }

    async handleUpload(req, res) {
        // Check content type
        if (!req.headers['content-type']?.includes('multipart/form-data')) {
            res.writeHead(400, { 
                'Content-Type': 'application/json; charset=UTF-8',
                'Access-Control-Allow-Origin': '*'
            });
            return res.end(JSON.stringify({
                success: false,
                error: 'Content-Type must be multipart/form-data'
            }));
        }

        const form = new IncomingForm({
            uploadDir: this.uploadDir,
            keepExtensions: true,
            maxFileSize: this.maxFileSize,
            multiples: false,
            maxFields: 5
        });

        try {
            const [fields, files] = await new Promise((resolve, reject) => {
                form.parse(req, (err, fields, files) => {
                    if (err) reject(err);
                    resolve([fields, files]);
                });
            });

            const file = files.file?.[0] || files.file;
            
            if (!file) {
                throw new Error('No file field found. Please upload a file with field name "file"');
            }

            // Validate file
            this.validateFile(file);

            // Generate unique filename (sanitized)
            const sanitizedOriginalName = this.sanitizeFilename(file.originalFilename);
            const newFilename = this.generateUniqueFilename(sanitizedOriginalName);
            
            // Validate path BEFORE file operations (prevent path traversal)
            const newPath = path.join(this.uploadDir, newFilename);
            const resolvedPath = path.resolve(newPath);
            const resolvedUploadDir = path.resolve(this.uploadDir);
            
            // Security check: ensure resolved path is within upload directory
            if (!resolvedPath.startsWith(resolvedUploadDir)) {
                // Clean up uploaded file
                try {
                    await fs.unlink(file.filepath);
                } catch (cleanupError) {
                    console.error('Error cleaning up file after path validation:', cleanupError);
                }
                throw new Error('Invalid file path - path traversal detected');
            }

            // Additional validation: check if file already exists (race condition prevention)
            try {
                await fs.access(newPath);
                // File exists, generate new name
                const timestamp = Date.now();
                const random = Math.random().toString(36).substring(2, 10);
                const ext = path.extname(newFilename);
                const basename = path.basename(newFilename, ext);
                const uniqueNewFilename = `${basename}_${timestamp}_${random}${ext}`;
                const uniqueNewPath = path.join(this.uploadDir, uniqueNewFilename);
                
                // Validate unique path
                const resolvedUniquePath = path.resolve(uniqueNewPath);
                if (!resolvedUniquePath.startsWith(resolvedUploadDir)) {
                    throw new Error('Invalid file path after uniqueness check');
                }
                
                // Move file to permanent location with file locking
                await this.moveFileWithLock(file.filepath, uniqueNewPath);
                return this.sendSuccessResponse(res, req, {
                    originalName: file.originalFilename,
                    filename: uniqueNewFilename,
                    size: file.size,
                    type: file.mimetype,
                    path: `/uploads/${uniqueNewFilename}`,
                    uploadedAt: new Date().toISOString()
                });
            } catch (accessError) {
                if (accessError.code === 'ENOENT') {
                    // File doesn't exist, safe to proceed
                    // Move file to permanent location with file locking
                    await this.moveFileWithLock(file.filepath, newPath);
                    // Send success response
                    this.sendSuccessResponse(res, req, {
                        originalName: file.originalFilename,
                        filename: newFilename,
                        size: file.size,
                        type: file.mimetype,
                        path: `/uploads/${newFilename}`,
                        uploadedAt: new Date().toISOString()
                    });
                } else {
                    throw accessError;
                }
            }

        } catch (error) {
            console.error('Upload error:', error);
            
            // Clean up any uploaded file on error
            if (error.filepath) {
                try {
                    await fs.unlink(error.filepath);
                } catch (cleanupError) {
                    console.error('Error cleaning up file:', cleanupError);
                }
            }

            const isDevelopment = process.env.NODE_ENV === 'development';
            const errorResponse = {
                success: false,
                error: error.message || 'Upload failed'
            };
            
            // Only include stack trace in development
            if (isDevelopment && error.stack) {
                errorResponse.details = error.stack;
            }

            res.writeHead(400, {
                'Content-Type': 'application/json; charset=UTF-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify(errorResponse));
        }
    }
}

// Create and export instance
const uploadHandler = new UploadHandler();

// Export the method properly bound
module.exports = {
    handleUpload: uploadHandler.handleUpload.bind(uploadHandler)
};      