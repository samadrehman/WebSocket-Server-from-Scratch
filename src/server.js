const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Import modules
const Router = require('./utils/router');
const { serveStatic } = require('./utils/staticHandler');
const { setupWebSocketServer } = require('./websocket/server');
const { handleUpload } = require('./utils/uploadHandler');

class WebServer {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.router = new Router();
        this.clients = new Map(); // Changed to Map for WebSocket module compatibility
        this.serverStats = {
            totalRequests: 0,
            activeConnections: 0,
            requestsPerSecond: 0,
            startTime: Date.now(),
            requestTimestamps: [] // Track requests for RPS calculation
        };
        // Lock for thread-safe access to requestTimestamps
        this.statsLock = false;
        
        this.setupDirectories();
        this.setupRoutes();
        this.startMetricsCalculation();
    }

    setupDirectories() {
        const dirs = ['public', 'uploads'];
        dirs.forEach(dir => {
            const dirPath = path.join(__dirname, '..', dir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
                console.log(`📁 Created directory: ${dir}`);
            }
        });
    }

    setupRoutes() {
        // GET routes
        this.router.get('/', (req, res) => {
            serveStatic(req, res, '/index.html');
        });

        this.router.get('/websocket-demo', (req, res) => {
            serveStatic(req, res, '/websocket-demo.html');
        });

        this.router.get('/whiteboard', (req, res) => {
            serveStatic(req, res, '/whiteboard.html');
        });

        this.router.get('/upload', (req, res) => {
            serveStatic(req, res, '/upload.html');
        });

        // File upload endpoint
        this.router.post('/upload', async (req, res) => {
            await handleUpload(req, res);
        });

        this.router.get('/api/stats', (req, res) => {
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                server: {
                    ...this.serverStats,
                    uptime: Math.floor((Date.now() - this.serverStats.startTime) / 1000)
                },
                webSocket: {
                    connections: this.clients.size,
                    uptime: Math.floor((Date.now() - this.serverStats.startTime) / 1000)
                },
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    memory: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
                }
            }));
        });

        // API endpoint for demo data
        this.router.get('/api/data', (req, res) => {
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                message: 'API endpoint working!',
                data: {
                    timestamp: new Date().toISOString(),
                    server: 'Web Server v2.0',
                    version: '2.0.0',
                    features: [
                        'HTTP Server',
                        'WebSocket Support',
                        'Static File Serving',
                        'RESTful API',
                        'Real-time Communication'
                    ]
                }
            }));
        });

        // API endpoint for server evolution info
        this.router.get('/api/evolution', (req, res) => {
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                evolution: {
                    version: '2.0.0',
                    improvements: [
                        'Security hardening (path traversal, XSS, SQL injection protection)',
                        'Performance optimization (async broadcasts, smart caching)',
                        'Memory leak prevention (heartbeat cleanup, connection management)',
                        'Connection management (limits, heartbeat, reconnection)',
                        'Error handling (safe error messages, graceful degradation)'
                    ],
                    architecture: 'Modular, scalable, production-ready',
                    builtWith: 'Node.js native modules (no Express.js)'
                }
            }));
        });

        // API endpoint for POST requests
        this.router.post('/api/data', async (req, res) => {
            res.writeHead(200, { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                message: 'POST request received successfully',
                received: req.body,
                timestamp: new Date().toISOString(),
                server: 'Web Server v2.0'
            }));
        });


        // Serve uploaded files
        this.router.get('/uploads/*', async (req, res) => {
            const filePath = req.parsedUrl.pathname;
            const fullPath = path.join(__dirname, '..', filePath);
            
            try {
                // Security check
                const resolvedPath = path.resolve(fullPath);
                const uploadsDir = path.resolve(__dirname, '..', 'uploads');
                if (!resolvedPath.startsWith(uploadsDir)) {
                    this.sendError(res, 403, 'Forbidden');
                    return;
                }
                
                const content = await fs.promises.readFile(fullPath);
                const ext = path.extname(fullPath);
                const contentType = this.getContentType(ext);
                
                res.writeHead(200, {
                    'Content-Type': contentType,
                    'Access-Control-Allow-Origin': '*'
                });
                res.end(content);
            } catch (error) {
                if (error.code === 'ENOENT') {
                    this.sendError(res, 404, 'File not found');
                } else {
                    console.error('Error serving uploaded file:', error);
                    this.sendError(res, 500, 'Internal Server Error');
                }
            }
        });

        // Static files catch-all
        this.router.get('*', (req, res) => {
            serveStatic(req, res, req.parsedUrl.pathname);
        });
    }

    // Calculate requests per second (thread-safe)
    startMetricsCalculation() {
        setInterval(() => {
            const now = Date.now();
            // Thread-safe filter operation
            while (this.statsLock) {
                // Wait for lock to be released (simple spin lock)
                // In production, consider using a proper mutex library
            }
            this.statsLock = true;
            try {
                // Keep only requests from last second
                this.serverStats.requestTimestamps = this.serverStats.requestTimestamps.filter(
                    timestamp => now - timestamp < 1000
                );
                this.serverStats.requestsPerSecond = this.serverStats.requestTimestamps.length;
            } finally {
                this.statsLock = false;
            }
        }, 1000);
    }

    // Log requests
    logRequest(req) {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] ${req.method} ${req.url}`);
    }

    // Parse request body
    async parseBody(req) {
        return new Promise((resolve) => {
            if (req.method === 'POST') {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', () => {
                    try {
                        req.body = JSON.parse(body);
                    } catch {
                        req.body = require('querystring').parse(body);
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    // Handle HTTP request
    async handleRequest(req, res) {
        const parsedUrl = url.parse(req.url, true);
        req.parsedUrl = parsedUrl;
        req.query = parsedUrl.query;
        
        // Log request
        this.logRequest(req);
        this.serverStats.totalRequests++;
        
        // Thread-safe timestamp addition
        while (this.statsLock) {
            // Wait for lock (simple spin lock)
        }
        this.statsLock = true;
        try {
            this.serverStats.requestTimestamps.push(Date.now());
        } finally {
            this.statsLock = false;
        }
        
        // Parse body if POST
        await this.parseBody(req);
        
        // Handle OPTIONS for CORS
        if (req.method === 'OPTIONS') {
            res.writeHead(200, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Max-Age': '86400'
            });
            res.end();
            return;
        }
        
        // Add CORS headers to all responses
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Find and execute route
        const handler = this.router.find(req.method, parsedUrl.pathname);
        
        if (handler) {
            try {
                await handler(req, res);
            } catch (error) {
                console.error('Handler error:', error);
                this.sendError(res, 500, 'Internal Server Error', error);
            }
        } else {
            // Try serving as static file
            try {
                await serveStatic(req, res, parsedUrl.pathname);
            } catch (error) {
                this.sendError(res, 404, 'Not Found', error);
            }
        }
    }

    // Get content type helper
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
            '.txt': 'text/plain',
            '.pdf': 'application/pdf'
        };
        return types[ext.toLowerCase()] || 'application/octet-stream';
    }

    // Error response (safe for production)
    sendError(res, code, message, error = null) {
        const isDevelopment = process.env.NODE_ENV === 'development';
        const errorResponse = {
            error: message,
            code: code,
            timestamp: new Date().toISOString()
        };
        
        // Only include stack trace in development
        if (isDevelopment && error) {
            errorResponse.stack = error.stack;
            errorResponse.details = error.message;
        }
        
        res.writeHead(code, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        res.end(JSON.stringify(errorResponse));
    }

    // Broadcast to all WebSocket clients (async, non-blocking)
    broadcast(data) {
        const message = JSON.stringify(data);
        // Use setImmediate to make this non-blocking
        setImmediate(() => {
            this.clients.forEach((client, clientId) => {
                if (client.readyState === 1) { // WebSocket.OPEN
                    try {
                        client.send(message);
                    } catch (error) {
                        console.error(`Error broadcasting to ${clientId}:`, error);
                        // Remove dead connection
                        if (client.readyState !== 1) {
                            this.clients.delete(clientId);
                        }
                    }
                }
            });
        });
    }

    // Broadcast chat message to subscribed clients (async, non-blocking)
    // This is only used for system messages, not user chat (user chat handled in handlers.js)
    broadcastChatMessage(message, from = 'System', clientId = null) {
        const chatMessage = {
            type: 'chat',
            data: {
                from,
                user: from,
                message,
                timestamp: new Date().toISOString(),
                clientId: clientId || null
            }
        };
        
        const messageStr = JSON.stringify(chatMessage);
        const clientsToRemove = []; // Collect clients to remove after iteration
        
        // Use setImmediate to make this non-blocking
        setImmediate(() => {
            // Create a copy to avoid iteration issues
            const clientsArray = Array.from(this.clients.entries());
            
            clientsArray.forEach(([id, client]) => {
                if (client.readyState === 1) {
                    // Only send if client has explicitly subscribed to chat
                    // Empty subscriptions means no subscriptions (opt-in model)
                    if (client.subscriptions && client.subscriptions.length > 0 && client.subscriptions.includes('chat')) {
                        try {
                            client.send(messageStr);
                        } catch (error) {
                            console.error(`Error sending chat message to ${id}:`, error);
                            // Mark for removal
                            if (client.readyState !== 1) {
                                clientsToRemove.push(id);
                            }
                        }
                    }
                } else {
                    // Mark dead connections for removal
                    clientsToRemove.push(id);
                }
            });
            
            // Remove dead connections after iteration
            clientsToRemove.forEach(id => {
                this.clients.delete(id);
            });
        });
    }

    // Broadcast metrics to subscribed clients (async, non-blocking)
    broadcastMetrics() {
        const metrics = {
            type: 'metrics',
            data: {
                totalRequests: this.serverStats.totalRequests,
                activeConnections: this.clients.size,
                requestsPerSecond: this.serverStats.requestsPerSecond,
                uptime: Math.floor((Date.now() - this.serverStats.startTime) / 1000)
            }
        };
        
        const metricsStr = JSON.stringify(metrics);
        const clientsToRemove = []; // Collect clients to remove after iteration
        
        // Use setImmediate to make this non-blocking
        setImmediate(() => {
            // Create a copy to avoid iteration issues
            const clientsArray = Array.from(this.clients.entries());
            
            clientsArray.forEach(([clientId, client]) => {
                if (client.readyState === 1) {
                    // Only send if client has explicitly subscribed to metrics
                    // Empty subscriptions means no subscriptions (opt-in model)
                    if (client.subscriptions && client.subscriptions.length > 0 && client.subscriptions.includes('metrics')) {
                        try {
                            client.send(metricsStr);
                        } catch (error) {
                            console.error(`Error sending metrics to ${clientId}:`, error);
                            // Mark for removal
                            if (client.readyState !== 1) {
                                clientsToRemove.push(clientId);
                            }
                        }
                    }
                } else {
                    // Mark dead connections for removal
                    clientsToRemove.push(clientId);
                }
            });
            
            // Remove dead connections after iteration
            clientsToRemove.forEach(clientId => {
                this.clients.delete(clientId);
            });
        });
    }

    // Start server
    start() {
        // Create HTTP server
        const server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        // Setup WebSocket server using the module
        const wss = setupWebSocketServer(this);

        // Handle WebSocket upgrade requests with path validation
        server.on('upgrade', (request, socket, head) => {
            const pathname = url.parse(request.url).pathname;
            
            // Validate WebSocket upgrade path (allow root and common paths)
            const allowedPaths = ['/', '/websocket-demo', '/whiteboard', '/ws'];
            if (!allowedPaths.includes(pathname)) {
                console.warn(`⚠️ WebSocket upgrade rejected for path: ${pathname}`);
                socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
                socket.destroy();
                return;
            }
            
            // Upgrade WebSocket connection
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        });

        // Start metrics broadcasting
        setInterval(() => {
            this.broadcastMetrics();
        }, 2000); // Broadcast every 2 seconds

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                console.error(`
╔══════════════════════════════════════════╗
║     ❌ Port ${this.port} is already in use    ║
╚══════════════════════════════════════════╝

To fix this, you can:

1. Kill the process using port ${this.port}:
   Windows:  netstat -ano | findstr :${this.port}
            taskkill /PID <PID> /F
   
   Or use:   npx kill-port ${this.port}

2. Use a different port:
   PORT=3001 npm start

3. Find and stop the existing server:
   Press Ctrl+C in the terminal running the server
                `);
                process.exit(1);
            } else {
                console.error('Server error:', error);
                process.exit(1);
            }
        });

        // Start server
        server.listen(this.port, () => {
            console.log(`
╔══════════════════════════════════════════╗
║     🚀 Web Server v2.0                  ║
║                                          ║
║  📡 HTTP Server: port ${this.port}            ║
║  🔌 WebSocket: Ready                    ║
║                                          ║
║  Available:                            ║
║  • http://localhost:${this.port}/              ║
║  • http://localhost:${this.port}/websocket-demo 
║  • http://localhost:${this.port}/whiteboard   ║
║  • http://localhost:${this.port}/api/stats    ║
║                                          ║
║  Press Ctrl+C to stop                   ║
╚══════════════════════════════════════════╝
            `);
        });

        // Store server instance for graceful shutdown
        this.httpServer = server;
        this.wss = wss;

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n\n🛑 Shutting down server gracefully...');
            // Close WebSocket connections
            this.clients.forEach((client) => {
                if (client.readyState === 1) {
                    client.close();
                }
            });
            wss.close();
            server.close(() => {
                console.log('✅ Server closed successfully');
                process.exit(0);
            });
        });
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new WebServer();
    server.start();
}

module.exports = WebServer;
