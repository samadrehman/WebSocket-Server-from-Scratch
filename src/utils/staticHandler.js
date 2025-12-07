const fs = require('fs').promises;
const path = require('path');

class StaticHandler {
    constructor() {
        this.publicDir = path.join(__dirname, '../../public');
    }

    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.css': 'text/css',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.txt': 'text/plain'
        };
        return types[ext.toLowerCase()] || 'application/octet-stream';
    }

    isStaticAsset(filePath) {
        // Files that should be cached (static assets)
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'];
        const ext = path.extname(filePath).toLowerCase();
        return staticExtensions.includes(ext);
    }

    isDynamicContent(filePath) {
        // Files that should NOT be cached (dynamic content)
        const dynamicExtensions = ['.html'];
        const ext = path.extname(filePath).toLowerCase();
        return dynamicExtensions.includes(ext);
    }

    async serveStatic(req, res, filePath) {
        try {
            // Default to index.html for root
            if (filePath === '/' || filePath === '') {
                filePath = '/index.html';
            }
            
            // Resolve full path
            const fullPath = path.join(this.publicDir, filePath);
            
            // Security check
            if (!fullPath.startsWith(this.publicDir)) {
                throw new Error('Forbidden');
            }

            const content = await fs.readFile(fullPath);
            const ext = path.extname(fullPath);
            const contentType = this.getContentType(ext);
            
            // Set appropriate cache headers based on file type
            const headers = {
                'Content-Type': contentType,
                'Access-Control-Allow-Origin': '*'
            };
            
            if (this.isStaticAsset(filePath)) {
                // Static assets: cache for 1 year (with versioning)
                headers['Cache-Control'] = 'public, max-age=31536000, immutable';
            } else if (this.isDynamicContent(filePath)) {
                // Dynamic content: no cache or short cache
                headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
                headers['Pragma'] = 'no-cache';
                headers['Expires'] = '0';
            } else {
                // Other files: cache for 1 hour
                headers['Cache-Control'] = 'public, max-age=3600';
            }
            
            res.writeHead(200, headers);
            res.end(content);

        } catch (error) {
            if (error.code === 'ENOENT') {
                // File not found
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - Not Found</h1><p>The requested file was not found.</p>');
            } else if (error.message === 'Forbidden') {
                res.writeHead(403, { 'Content-Type': 'text/html' });
                res.end('<h1>403 - Forbidden</h1>');
            } else {
                console.error('Static file error:', error);
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('<h1>500 - Internal Server Error</h1>');
            }
        }
    }
}

// Export
const handler = new StaticHandler();
module.exports = {
    serveStatic: handler.serveStatic.bind(handler)
};