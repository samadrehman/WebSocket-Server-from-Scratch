class WebSocketDemo {
    constructor() {
        this.ws = null;
        this.clientId = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.pingStartTime = null;
        this.messageCount = 0;
        this.reconnectTimeout = null;
        this.autoReconnect = true;
        
        // Wait for DOM to be ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                this.initialize();
            });
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.bindEvents();
        // Don't auto-connect - let user click Connect button
        // this.connectWebSocket();
    }

    bindEvents() {
        // Enter key sends message (with null check)
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // Auto-reconnect checkbox (if it exists)
        const autoReconnectCheckbox = document.getElementById('auto-reconnect');
        if (autoReconnectCheckbox) {
            autoReconnectCheckbox.addEventListener('change', (e) => {
                this.autoReconnect = e.target.checked;
            });
        }

        // Window close - disconnect WebSocket
        window.addEventListener('beforeunload', () => {
            if (this.ws) {
                this.ws.close();
            }
        });
    }

    connectWebSocket() {
        // Clear any existing reconnection timeout
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        
        // Determine WebSocket URL based on current protocol
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        this.log(`Connecting to ${wsUrl}...`);
        
        try {
            this.ws = new WebSocket(wsUrl);
        } catch (error) {
            this.log(`❌ Failed to create WebSocket: ${error.message}`);
            this.updateConnectionStatus(false);
            return;
        }
        
        this.ws.onopen = () => {
            this.log('✅ WebSocket connected');
            this.updateConnectionStatus(true);
            this.reconnectAttempts = 0;
            
            // Subscribe to default channels immediately
            try {
                this.ws.send(JSON.stringify({
                    type: 'subscribe',
                    data: {
                        channels: ['chat', 'metrics']
                    }
                }));
                this.log('📡 Subscribed to chat and metrics channels');
            } catch (error) {
                this.log(`❌ Error subscribing: ${error.message}`);
            }
        };

        this.ws.onmessage = (event) => {
            try {
                // Check if message is actually JSON
                if (typeof event.data !== 'string') {
                    this.log(`❌ Received non-string message`);
                    return;
                }
                
                // Check if it looks like HTML (404 error page)
                if (event.data.trim().startsWith('<')) {
                    this.log(`❌ Received HTML instead of JSON. Server may have returned an error page.`);
                    return;
                }
                
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                this.log(`❌ Failed to parse message: ${error.message}`);
                // Log the raw message for debugging
                if (event.data && event.data.length < 200) {
                    this.log(`Raw message: ${event.data.substring(0, 100)}...`);
                }
            }
        };

        this.ws.onclose = (event) => {
            this.log(`🔌 WebSocket closed: ${event.code} ${event.reason || 'No reason'}`);
            this.updateConnectionStatus(false);
            this.ws = null;
            
            // Attempt reconnection (only if not manually closed)
            if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                this.reconnectAttempts++;
                // Exponential backoff with jitter and max delay
                const baseDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
                const jitter = Math.random() * 1000; // Add randomness to prevent thundering herd
                const delay = baseDelay + jitter;
                
                this.log(`Reconnecting in ${(delay/1000).toFixed(1)} seconds... (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                
                // Use a longer delay for later attempts to give server time to recover
                const reconnectTimeout = setTimeout(() => {
                    if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                        this.connectWebSocket();
                    }
                }, delay);
                
                // Store timeout so it can be cleared if needed
                this.reconnectTimeout = reconnectTimeout;
            } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
                this.log('❌ Max reconnection attempts reached. Click "Connect" to retry or refresh the page.');
                // Reset attempts after a longer delay to allow retry
                setTimeout(() => {
                    this.reconnectAttempts = 0;
                    this.log('🔄 Reconnection attempts reset. You can try connecting again.');
                }, 60000); // Reset after 1 minute
            }
        };

        this.ws.onerror = (error) => {
            this.log(`❌ WebSocket error: ${error.message}`);
        };
    }

    handleMessage(message) {
        this.messageCount++;
        
        switch (message.type) {
            case 'system':
                this.handleSystemMessage(message.data);
                break;
                
            case 'chat':
                this.handleChatMessage(message.data);
                break;
                
            case 'metrics':
                this.handleMetricsMessage(message.data);
                break;
                
            case 'pong':
                this.handlePongMessage(message.data);
                break;
                
            case 'subscription':
                this.handleSubscriptionMessage(message.data);
                break;
                
            case 'error':
                this.log(`❌ Error: ${message.data.message}`);
                break;
                
            default:
                this.log(`📨 Unknown message type: ${message.type}`, message.data);
        }
    }

    handleSystemMessage(data) {
        if (data && data.message && data.message.includes('Connected')) {
            this.clientId = data.clientId;
            const clientIdEl = document.getElementById('client-id');
            const connectionCountEl = document.getElementById('connection-count');
            if (clientIdEl && this.clientId) {
                clientIdEl.textContent = `ID: ${this.clientId.substring(0, 8)}`;
            }
            if (connectionCountEl && data.activeConnections !== undefined) {
                connectionCountEl.textContent = `Connections: ${data.activeConnections}`;
            }
        }
        if (data && data.message) {
            this.addChatMessage(data.message, 'system');
        }
    }

    handleChatMessage(data) {
        // Server doesn't echo back to sender, so all received messages are from others
        // But check clientId just in case
        const isYou = data.clientId === this.clientId;
        if (!isYou) {
            // Only show messages from others (server filters out sender)
            this.addChatMessage(data.message, data.user || data.from, false, data.timestamp);
        }
    }

    handleMetricsMessage(data) {
        if (!data) return;
        
        // Update metrics display with null checks
        const requestsTotalEl = document.getElementById('requests-total');
        const requestsPerSecondEl = document.getElementById('requests-per-second');
        const activeConnectionsEl = document.getElementById('active-connections');
        const serverUptimeEl = document.getElementById('server-uptime');
        const connectionCountEl = document.getElementById('connection-count');
        
        if (requestsTotalEl && data.totalRequests !== undefined) {
            requestsTotalEl.textContent = data.totalRequests.toLocaleString();
        }
        if (requestsPerSecondEl && data.requestsPerSecond !== undefined) {
            requestsPerSecondEl.textContent = data.requestsPerSecond.toFixed(2);
        }
        if (activeConnectionsEl && data.activeConnections !== undefined) {
            activeConnectionsEl.textContent = data.activeConnections;
        }
        if (serverUptimeEl && data.uptime !== undefined) {
            serverUptimeEl.textContent = `${data.uptime}s`;
        }
        if (connectionCountEl && data.activeConnections !== undefined) {
            connectionCountEl.textContent = `Connections: ${data.activeConnections}`;
        }
    }

    handlePongMessage(data) {
        if (this.pingStartTime) {
            const ping = Date.now() - this.pingStartTime;
            const pingEl = document.getElementById('ping');
            if (pingEl) {
                pingEl.textContent = `Ping: ${ping}ms`;
            }
            this.pingStartTime = null;
        }
    }

    handleSubscriptionMessage(data) {
        if (data && data.channels) {
            this.log(`📢 Subscription updated: ${data.channels.length > 0 ? data.channels.join(', ') : 'none (opted out)'}`);
        }
    }

    addChatMessage(message, user = 'System', isYou = false, timestamp = null) {
        const chatMessages = document.getElementById('chat-messages');
        if (!chatMessages) {
            console.error('Chat messages container not found');
            return;
        }
        
        if (!message || typeof message !== 'string') {
            console.error('Invalid message:', message);
            return;
        }
        
        const messageDiv = document.createElement('div');
        
        messageDiv.className = `message ${isYou ? 'you' : ''} ${user === 'System' ? 'system' : ''}`;
        
        let timeStr = '';
        const showTimestampsCheckbox = document.getElementById('show-timestamps');
        if (timestamp && showTimestampsCheckbox && showTimestampsCheckbox.checked) {
            const time = new Date(timestamp);
            timeStr = `<small style="color: #718096; font-size: 0.8rem;">[${time.toLocaleTimeString()}]</small> `;
        } else if (!timestamp && showTimestampsCheckbox && showTimestampsCheckbox.checked) {
            const time = new Date();
            timeStr = `<small style="color: #718096; font-size: 0.8rem;">[${time.toLocaleTimeString()}]</small> `;
        }
        
        // Escape HTML to prevent XSS
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };
        
        messageDiv.innerHTML = `
            ${timeStr}
            <strong style="color: ${isYou ? '#4299e1' : user === 'System' ? '#48bb78' : '#2d3748'};">${escapeHtml(user)}:</strong> 
            <span>${escapeHtml(message)}</span>
        `;
        
        chatMessages.appendChild(messageDiv);
        
        // Auto-scroll if enabled (with null check)
        const autoScrollCheckbox = document.getElementById('auto-scroll');
        if (autoScrollCheckbox && autoScrollCheckbox.checked && chatMessages) {
            // Use requestAnimationFrame for smooth scrolling
            requestAnimationFrame(() => {
                chatMessages.scrollTop = chatMessages.scrollHeight;
            });
        }
    }

    sendMessage() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Not connected to WebSocket server. Please wait for connection...');
            this.log('❌ Cannot send message: WebSocket not connected');
            return;
        }
        
        const input = document.getElementById('message-input');
        const message = input.value.trim();
        
        if (!message) {
            this.log('⚠️ Cannot send empty message');
            return;
        }
        
        // Show message immediately in chat (optimistic UI update)
        // Server will NOT echo back to sender, so this is the only place it appears
        this.addChatMessage(message, 'You', true);
        
        const chatMessage = {
            type: 'chat',
            data: {
                message: message, // Standardized on 'message' field only
                user: 'You',
                from: 'You'
            }
        };
        
        try {
            this.ws.send(JSON.stringify(chatMessage));
            this.log(`📤 Sent message: "${message.substring(0, 30)}${message.length > 30 ? '...' : ''}"`);
        } catch (error) {
            this.log(`❌ Error sending message: ${error.message}`);
            alert('Failed to send message. Please try again.');
        }
        
        // Clear input
        input.value = '';
        input.focus();
    }

    sendPing() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Not connected');
            return;
        }
        
        this.pingStartTime = Date.now();
        this.ws.send(JSON.stringify({ type: 'ping' }));
        this.log('📡 Sent ping request...');
    }

    updateSubscriptions() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Not connected');
            return;
        }
        
        const subscriptions = [];
        if (document.getElementById('sub-chat').checked) subscriptions.push('chat');
        if (document.getElementById('sub-metrics').checked) subscriptions.push('metrics');
        if (document.getElementById('sub-notifications').checked) subscriptions.push('notification');
        
        const subscriptionMessage = {
            type: 'subscribe',
            data: {
                channels: subscriptions
            }
        };
        
        this.ws.send(JSON.stringify(subscriptionMessage));
    }

    testBroadcast() {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            alert('Not connected');
            return;
        }
        
        // Send a test message that will be broadcast to all
        const testMessage = {
            type: 'chat',
            data: {
                message: 'This is a test broadcast message!',
                user: 'Broadcast Test'
            }
        };
        
        this.ws.send(JSON.stringify(testMessage));
    }

    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    clearChat() {
        const chatMessages = document.getElementById('chat-messages');
        if (chatMessages) {
            chatMessages.innerHTML = '';
        }
    }

    updateConnectionStatus(connected) {
        const statusEl = document.getElementById('connection-status');
        if (connected) {
            statusEl.textContent = '🟢 Connected';
            statusEl.className = 'connection-status connected';
            document.getElementById('connect-btn').disabled = true;
            document.getElementById('disconnect-btn').disabled = false;
        } else {
            statusEl.textContent = '🔴 Disconnected';
            statusEl.className = 'connection-status disconnected';
            document.getElementById('connect-btn').disabled = false;
            document.getElementById('disconnect-btn').disabled = true;
        }
    }

    log(message) {
        const logEl = document.getElementById('connection-log');
        if (!logEl) {
            console.log(message); // Fallback to console
            return;
        }
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${timestamp}] ${message}`;
        logEl.appendChild(logEntry);
        logEl.scrollTop = logEl.scrollHeight;
    }

    clearConsole() {
        const logEl = document.getElementById('connection-log');
        if (logEl) {
            logEl.innerHTML = '';
        }
    }
}

// Global instance - initialized after DOM is ready
let wsDemo = null;

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        wsDemo = new WebSocketDemo();
    });
} else {
    wsDemo = new WebSocketDemo();
}

// Global functions for button clicks (with null checks)
function connectWebSocket() {
    if (wsDemo) {
        wsDemo.connectWebSocket();
    } else {
        console.error('WebSocketDemo not initialized yet');
        alert('Please wait for page to load completely');
    }
}

function disconnectWebSocket() {
    if (wsDemo) {
        wsDemo.disconnectWebSocket();
    }
}

function sendMessage() {
    if (wsDemo) {
        wsDemo.sendMessage();
    }
}

function sendPing() {
    if (wsDemo) {
        wsDemo.sendPing();
    }
}

function updateSubscriptions() {
    if (wsDemo) {
        wsDemo.updateSubscriptions();
    }
}

function testBroadcast() {
    if (wsDemo) {
        wsDemo.testBroadcast();
    }
}

function clearChat() {
    if (wsDemo) {
        wsDemo.clearChat();
    }
}

function clearConsole() {
    if (wsDemo) {
        wsDemo.clearConsole();
    }
}