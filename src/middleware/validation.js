const { schemas, customRules, customMessages } = require('../validation/schemas');
const Joi = require('joi');

// Extend Joi with custom rules
const extendedJoi = Joi.extend((joi) => ({
    type: 'string',
    base: joi.string(),
    messages: customMessages,
    rules: {
        noHtml: {
            validate(value, helpers) {
                return customRules.noHtml(value, helpers);
            }
        },
        noSqlInjection: {
            validate(value, helpers) {
                return customRules.noSqlInjection(value, helpers);
            }
        },
        noXss: {
            validate(value, helpers) {
                return customRules.noXss(value, helpers);
            }
        }
    }
}));

// Validation middleware factory
function validateRequest(schemaName) {
    return (req, res, next) => {
        const schema = schemas[schemaName];
        if (!schema) {
            return next(new Error(`Validation schema '${schemaName}' not found`));
        }

        // Validate request body
        const { error, value } = extendedJoi.compile(schema).validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });

        if (error) {
            // Format validation errors
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            // Send validation error response
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                error: 'Validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
            }));
        }

        // Replace body with validated data
        req.body = value;
        next();
    };
}

// File validation middleware
function validateFile(req, res, next) {
    if (!req.files || !req.files.file) {
        return next();
    }

    const file = req.files.file[0] || req.files.file;
    const errors = [];

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
        errors.push({
            field: 'file',
            message: 'File size exceeds 10MB limit',
            type: 'file.tooLarge'
        });
    }

    // Check file type using magic numbers
    const allowedTypes = {
        'image/jpeg': [0xFF, 0xD8, 0xFF],
        'image/png': [0x89, 0x50, 0x4E, 0x47],
        'image/gif': [0x47, 0x49, 0x46],
        'application/pdf': [0x25, 0x50, 0x44, 0x46]
    };

    // Read first few bytes for magic number check
    const fs = require('fs');
    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(file.path, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const fileSignature = Array.from(buffer.slice(0, 4));
    let validType = false;

    for (const [mimeType, signature] of Object.entries(allowedTypes)) {
        if (signature.every((byte, index) => byte === fileSignature[index])) {
            validType = true;
            break;
        }
    }

    if (!validType) {
        errors.push({
            field: 'file',
            message: 'File type not allowed. Allowed: JPEG, PNG, GIF, PDF',
            type: 'file.invalidType'
        });
    }

    if (errors.length > 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
            error: 'File validation failed',
            details: errors,
            timestamp: new Date().toISOString()
        }));
    }

    next();
}

// Query parameter validation
function validateQuery(schema) {
    return (req, res, next) => {
        const { error, value } = extendedJoi.compile(schema).validate(req.query, {
            abortEarly: false,
            convert: true
        });

        if (error) {
            const validationErrors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                type: detail.type
            }));

            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                error: 'Query validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
            }));
        }

        req.query = value;
        next();
    };
}

module.exports = {
    validateRequest,
    validateFile,
    validateQuery,
    extendedJoi
};