const Joi = require('joi');

const schemas = {
    // Message schema for chat/messages
    message: Joi.object({
        message: Joi.string()
            .min(1)
            .max(500)
            .required()
            .messages({
                'string.empty': 'Message cannot be empty',
                'string.max': 'Message cannot exceed 400 characters'
            }),
        user: Joi.string()
            .min(1)
            .max(50)
            .optional()
            .default('Anonymous'),
        type: Joi.string()
            .valid('chat', 'notification', 'alert')
            .optional()
            .default('chat')
    }),

    // File upload schema
    fileUpload: Joi.object({
        fileName: Joi.string()
            .min(1)
            .max(255)
            .required(),
        fileSize: Joi.number()
            .max(10 * 1024 * 1024) // 10MB
            .required(),
        fileType: Joi.string()
            .pattern(/^[a-zA-Z0-9]+\/[a-zA-Z0-9.+-]+$/)
            .required(),
        description: Joi.string()
            .max(1000)
            .optional()
    }),

    // Contact form schema
    contact: Joi.object({
        name: Joi.string()
            .min(2)
            .max(100)
            .required(),
        email: Joi.string()
            .email()
            .required(),
        subject: Joi.string()
            .min(5)
            .max(200)
            .required(),
        message: Joi.string()
            .min(10)
            .max(5000)
            .required()
    }),

    // User registration schema
    userRegistration: Joi.object({
        username: Joi.string()
            .alphanum()
            .min(3)
            .max(30)
            .required(),
        email: Joi.string()
            .email()
            .required(),
        password: Joi.string()
            .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
            .required()
            .messages({
                'string.pattern.base': 'Password must contain at least 8 characters, one uppercase, one lowercase, one number and one special character'
            }),
        confirmPassword: Joi.string()
            .valid(Joi.ref('password'))
            .required()
            .messages({
                'any.only': 'Passwords do not match'
            })
    })
};

// Custom validation rules
const customRules = {
    // Check if string contains HTML tags
    noHtml: (value, helpers) => {
        const htmlRegex = /<[^>]*>/;
        if (htmlRegex.test(value)) {
            return helpers.error('string.noHtml');
        }
        return value;
    },

    // Check for SQL injection patterns
    noSqlInjection: (value, helpers) => {
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|EXEC|ALTER)\b)/i,
            /(--|\/\*|\*\/|;)/,
            /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i
        ];
        
        for (const pattern of sqlPatterns) {
            if (pattern.test(value)) {
                return helpers.error('string.noSqlInjection');
            }
        }
        return value;
    },

    // Check for XSS patterns
    noXss: (value, helpers) => {
        const xssPatterns = [
            /javascript:/i,
            /on\w+\s*=/i,
            /<\s*(script|iframe|object|embed)/i
        ];
        
        for (const pattern of xssPatterns) {
            if (pattern.test(value)) {
                return helpers.error('string.noXss');
            }
        }
        return value;
    }
};

// Add custom messages
const customMessages = {
    'string.noHtml': 'HTML tags are not allowed',
    'string.noSqlInjection': 'Potential SQL injection detected',
    'string.noXss': 'Potential XSS attack detected'
};

module.exports = {
    schemas,
    customRules,
    customMessages
};