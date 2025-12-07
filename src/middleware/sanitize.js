const sanitizeHtml = require('sanitize-html');

// HTML sanitization configuration
const sanitizeOptions = {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'code'],
    allowedAttributes: {
        'a': ['href', 'title', 'target']
    },
    allowedIframeHostnames: [],
    selfClosing: ['br'],
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: {},
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
    allowProtocolRelative: false
};

// Sanitize input middleware
function sanitizeInput(req, res, next) {
    // Sanitize query parameters
    if (req.query) {
        req.query = sanitizeObject(req.query);
    }

    // Sanitize body parameters
    if (req.body) {
        req.body = sanitizeObject(req.body);
    }

    // Sanitize URL parameters
    if (req.params) {
        req.params = sanitizeObject(req.params);
    }

    next();
}

// Sanitize an object recursively
function sanitizeObject(obj) {
    if (typeof obj !== 'object' || obj === null) {
        return sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
        return obj.map(item => sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
}

// Sanitize a single value
function sanitizeValue(value) {
    if (typeof value === 'string') {
        // Remove null bytes and control characters
        let sanitized = value.replace(/[\0-\x1F\x7F]/g, '');
        
        // Trim whitespace
        sanitized = sanitized.trim();
        
        // HTML sanitization for user-generated content
        sanitized = sanitizeHtml(sanitized, sanitizeOptions);
        
        // Limit length (prevent DoS)
        if (sanitized.length > 10000) {
            sanitized = sanitized.substring(0, 10000);
        }
        
        return sanitized;
    }
    
    return value;
}

// SQL injection prevention
function sqlInjectionCheck(input) {
    const dangerousPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/i,
        /(--|\/\*|\*\/|;)/,
        /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
        /(UNION\s+ALL|UNION\s+SELECT)/i,
        /(EXEC\s*\(|EXECUTE\s*\(|sp_executesql)/i
    ];

    for (const pattern of dangerousPatterns) {
        if (pattern.test(input)) {
            return false;
        }
    }
    
    return true;
}

// XSS prevention
function xssCheck(input) {
    const xssPatterns = [
        /javascript:/i,
        /vbscript:/i,
        /on\w+\s*=/i,
        /<\s*(script|iframe|object|embed|frame|frameset)/i,
        /expression\s*\(/i,
        /url\s*\(/i
    ];

    for (const pattern of xssPatterns) {
        if (pattern.test(input)) {
            return false;
        }
    }
    
    return true;
}

// File name sanitization
function sanitizeFilename(filename) {
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

module.exports = {
    sanitizeInput,
    sanitizeObject,
    sanitizeValue,
    sqlInjectionCheck,
    xssCheck,
    sanitizeFilename
};