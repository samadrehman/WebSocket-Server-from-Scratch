const WebSocket = require('ws');
const { handleChatMessage, handleDrawing, handleSubscription } = require('./handlers');

// Configuration
const MAX_CONNECTIONS = 1000; // Maximum WebSocket connections
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const PING_TIMEOUT = 10000; // 10 seconds timeout for pong

function setupWebSocketServer(serverInstance) {
    const wss = new WebSocket.Server({ 
        noServer: true,
        clientTracking: true,
        perMessageDeflate: false // Disable compression for better performance
    });
    const heartbeats = new Map();

    wss.on('connection', (ws, req) => {
        // Check connection limit using actual client count
        const currentConnections = serverInstance.clients.size;
        if (currentConnections >= MAX_CONNECTIONS) {
            console.warn(`⚠️ Connection limit reached (${MAX_CONNECTIONS}), rejecting new connection`);
            ws.close(1008, 'Server at capacity');
            return;
        }

        const clientId = Date.now().toString(36) + Math.random().toString(36).substring(2);
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        
        // Initialize client
        ws.id = clientId;
        ws.ip = ip;
        ws.subscriptions = []; // Start with no subscriptions - empty means no subscriptions (opt-in)
        ws.isAlive = true;
        ws.connectedAt = Date.now();
        ws.pingTimeout = null; // Track ping timeout to prevent race conditions
        
        // Store client
        serverInstance.clients.set(clientId, ws);
        
        console.log(`🔌 New WebSocket connection: ${clientId} from ${ip} (${serverInstance.clients.size}/${MAX_CONNECTIONS})`);
        
        // Setup heartbeat with proper error handling and timeout management
        const heartbeatInterval = setInterval(() => {
            try {
                if (!ws.isAlive) {
                    console.log(`💔 Client ${clientId} heartbeat failed, terminating`);
                    clearInterval(heartbeatInterval);
                    if (ws.pingTimeout) {
                        clearTimeout(ws.pingTimeout);
                        ws.pingTimeout = null;
                    }
                    heartbeats.delete(clientId);
                    ws.terminate();
                    return;
                }
                ws.isAlive = false;
                ws.ping();
                
                // Clear any existing timeout to prevent race condition
                if (ws.pingTimeout) {
                    clearTimeout(ws.pingTimeout);
                }
                
                // Set timeout for pong response (only one timeout at a time)
                ws.pingTimeout = setTimeout(() => {
                    if (!ws.isAlive && ws.readyState === 1) {
                        console.log(`💔 Client ${clientId} pong timeout, terminating`);
                        clearInterval(heartbeatInterval);
                        heartbeats.delete(clientId);
                        ws.pingTimeout = null;
                        ws.terminate();
                    }
                }, PING_TIMEOUT);
            } catch (error) {
                console.error(`Heartbeat error for ${clientId}:`, error);
                clearInterval(heartbeatInterval);
                if (ws.pingTimeout) {
                    clearTimeout(ws.pingTimeout);
                    ws.pingTimeout = null;
                }
                heartbeats.delete(clientId);
                try {
                    ws.terminate();
                } catch (e) {
                    // Ignore errors during termination
                }
            }
        }, HEARTBEAT_INTERVAL);
        
        heartbeats.set(clientId, heartbeatInterval);

        // Send welcome message with error handling
        try {
            ws.send(JSON.stringify({
                type: 'system',
                data: {
                    message: 'Connected to WebSocket server',
                    clientId,
                    timestamp: new Date().toISOString(),
                    activeConnections: serverInstance.clients.size,
                    maxConnections: MAX_CONNECTIONS
                }
            }));
        } catch (error) {
            console.error(`Error sending welcome message to ${clientId}:`, error);
        }

        // Send initial metrics
        try {
            const metrics = {
                type: 'metrics',
                data: {
                    totalRequests: serverInstance.serverStats.totalRequests,
                    activeConnections: serverInstance.clients.size,
                    requestsPerSecond: serverInstance.serverStats.requestsPerSecond,
                    uptime: Math.floor((Date.now() - serverInstance.serverStats.startTime) / 1000)
                }
            };
            ws.send(JSON.stringify(metrics));
        } catch (error) {
            console.error(`Error sending initial metrics to ${clientId}:`, error);
        }

        // Message handler
        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                handleWebSocketMessage(ws, message, serverInstance);
            } catch (error) {
                console.error('WebSocket message error:', error);
                try {
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: { message: 'Invalid message format' }
                    }));
                } catch (sendError) {
                    console.error(`Error sending error message to ${clientId}:`, sendError);
                }
            }
        });

        // Heartbeat response - clear timeout on successful pong
        ws.on('pong', () => {
            ws.isAlive = true;
            if (ws.pingTimeout) {
                clearTimeout(ws.pingTimeout);
                ws.pingTimeout = null;
            }
        });

        // Handle close with proper cleanup
        ws.on('close', (code, reason) => {
            console.log(`🔌 WebSocket closed: ${clientId} (code: ${code}, reason: ${reason || 'none'})`);
            
            // Clear heartbeat with error handling
            const heartbeat = heartbeats.get(clientId);
            if (heartbeat) {
                try {
                    clearInterval(heartbeat);
                } catch (error) {
                    console.error(`Error clearing heartbeat for ${clientId}:`, error);
                }
                heartbeats.delete(clientId);
            }
            
            // Clear ping timeout
            if (ws.pingTimeout) {
                clearTimeout(ws.pingTimeout);
                ws.pingTimeout = null;
            }
            
            // Remove from clients
            serverInstance.clients.delete(clientId);
            
            // Broadcast connection count update (async, non-blocking)
            setImmediate(() => {
                try {
                    serverInstance.broadcastMetrics();
                } catch (error) {
                    console.error('Error broadcasting metrics after disconnect:', error);
                }
            });
            
            // Notify other clients (async, non-blocking)
            setImmediate(() => {
                try {
                    serverInstance.broadcastChatMessage(
                        `User ${clientId.substring(0, 6)} disconnected`,
                        'System'
                    );
                } catch (error) {
                    console.error('Error broadcasting disconnect message:', error);
                }
            });
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error(`WebSocket error for ${clientId}:`, error);
            // Clean up on error
            const heartbeat = heartbeats.get(clientId);
            if (heartbeat) {
                clearInterval(heartbeat);
                heartbeats.delete(clientId);
            }
            serverInstance.clients.delete(clientId);
            // Use serverInstance.clients.size as single source of truth
            connectionCount = serverInstance.clients.size;
        });
    });

    // Handle different WebSocket message types
    function handleWebSocketMessage(ws, message, server) {
        switch (message.type) {
            case 'chat':
                handleChatMessage(ws, message.data, server);
                break;
                
            case 'draw':
                handleDrawing(ws, message.data, server);
                break;
                
            case 'subscribe':
                handleSubscription(ws, message.data, server);
                break;
                
            case 'ping':
                try {
                    ws.send(JSON.stringify({ type: 'pong', data: { timestamp: Date.now() } }));
                } catch (error) {
                    console.error(`Error sending pong to ${ws.id}:`, error);
                }
                break;
                
            default:
                try {
                    ws.send(JSON.stringify({
                        type: 'error',
                        data: { message: `Unknown message type: ${message.type}` }
                    }));
                } catch (error) {
                    console.error(`Error sending error message to ${ws.id}:`, error);
                }
        }
    }

    // Cleanup on server shutdown
    wss.on('close', () => {
        console.log('WebSocket server closing, cleaning up heartbeats...');
        heartbeats.forEach((interval, clientId) => {
            try {
                clearInterval(interval);
            } catch (error) {
                console.error(`Error clearing heartbeat for ${clientId}:`, error);
            }
        });
        heartbeats.clear();
    });

    return wss;
}

module.exports = { setupWebSocketServer };