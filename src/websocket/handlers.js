/**
 * WebSocket Message Handlers
 * Handles different types of WebSocket messages (chat, drawing, subscriptions)
 */

/**
 * Handle chat messages from clients
 */
function handleChatMessage(ws, data, server) {
    // Standardize on 'message' field only - no support for 'text' field
    if (!data || !data.message || typeof data.message !== 'string') {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid chat message format. Required: { type: "chat", data: { message: "..." } }' }
            }));
        } catch (error) {
            console.error(`Error sending chat validation error to ${ws.id}:`, error);
        }
        return;
    }
    
    const messageText = data.message.trim();
    
    // Check if message is empty after trimming
    if (messageText.length === 0) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Message cannot be empty' }
            }));
        } catch (error) {
            console.error(`Error sending empty message error to ${ws.id}:`, error);
        }
        return;
    }
    
    // Validate message length
    if (messageText.length > 500) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Message too long. Maximum 500 characters.' }
            }));
        } catch (error) {
            console.error(`Error sending message length error to ${ws.id}:`, error);
        }
        return;
    }

    const chatMessage = {
        type: 'chat',
        data: {
            from: data.from || data.user || `User_${ws.id.substring(0, 6)}`,
            user: data.user || data.from || `User_${ws.id.substring(0, 6)}`,
            message: messageText,
            timestamp: new Date().toISOString(),
            clientId: ws.id
        }
    };

    // Broadcast to all subscribed clients (async, non-blocking)
    // DO NOT echo back to sender - client already shows message optimistically
    setImmediate(() => {
        const messageStr = JSON.stringify(chatMessage);
        const clientsToRemove = []; // Collect clients to remove after iteration
        
        // Create a copy of clients to avoid iteration issues
        const clientsArray = Array.from(server.clients.entries());
        
        clientsArray.forEach(([clientId, client]) => {
            // Skip the sender - don't echo back
            if (clientId === ws.id) {
                return;
            }
            
            if (client.readyState === 1) {
                // Only send if client has explicitly subscribed to chat
                // Empty subscriptions means no subscriptions (opt-in model)
                if (client.subscriptions && client.subscriptions.length > 0 && client.subscriptions.includes('chat')) {
                    try {
                        client.send(messageStr);
                    } catch (error) {
                        console.error(`Error sending chat message to ${clientId}:`, error);
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
            server.clients.delete(clientId);
        });
    });
}

/**
 * Handle drawing/whiteboard messages
 */
function handleDrawing(ws, data, server) {
    if (!data || !data.action) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid drawing message format' }
            }));
        } catch (error) {
            console.error(`Error sending drawing validation error to ${ws.id}:`, error);
        }
        return;
    }

    const drawMessage = {
        type: 'draw',
        data: {
            ...data,
            clientId: ws.id,
            timestamp: new Date().toISOString()
        }
    };

    // Broadcast to all clients subscribed to draw events (async, non-blocking)
    // DO NOT echo back to sender
    setImmediate(() => {
        const messageStr = JSON.stringify(drawMessage);
        const clientsToRemove = []; // Collect clients to remove after iteration
        
        // Create a copy to avoid iteration issues
        const clientsArray = Array.from(server.clients.entries());
        
        clientsArray.forEach(([clientId, client]) => {
            // Skip the sender - don't echo back
            if (clientId === ws.id) {
                return;
            }
            
            if (client.readyState === 1) {
                // Only send if client has explicitly subscribed to draw
                // Empty subscriptions means no subscriptions (opt-in model)
                if (client.subscriptions && client.subscriptions.length > 0 && client.subscriptions.includes('draw')) {
                    try {
                        client.send(messageStr);
                    } catch (error) {
                        console.error(`Error sending draw message to ${clientId}:`, error);
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
            server.clients.delete(clientId);
        });
    });
}

/**
 * Handle subscription requests
 */
function handleSubscription(ws, data, server) {
    if (!data || !data.channels || !Array.isArray(data.channels)) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: 'Invalid subscription format. Expected channels array.' }
            }));
        } catch (error) {
            console.error(`Error sending subscription error to ${ws.id}:`, error);
        }
        return;
    }

    // Validate channel names
    const validChannels = ['chat', 'metrics', 'draw', 'notification'];
    const invalidChannels = data.channels.filter(ch => !validChannels.includes(ch));
    
    if (invalidChannels.length > 0) {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                data: { 
                    message: `Invalid channel names: ${invalidChannels.join(', ')}. Valid channels: ${validChannels.join(', ')}` 
                }
            }));
        } catch (error) {
            console.error(`Error sending channel validation error to ${ws.id}:`, error);
        }
        return;
    }

    // Update client subscriptions (allow opt-out by sending empty array)
    ws.subscriptions = data.channels;

    try {
        ws.send(JSON.stringify({
            type: 'subscription',
            data: {
                message: 'Subscriptions updated',
                channels: ws.subscriptions,
                timestamp: new Date().toISOString()
            }
        }));
    } catch (error) {
        console.error(`Error sending subscription confirmation to ${ws.id}:`, error);
    }

    console.log(`📡 Client ${ws.id} subscribed to: ${ws.subscriptions.length > 0 ? ws.subscriptions.join(', ') : 'none (opted out)'}`);
}

module.exports = {
    handleChatMessage,
    handleDrawing,
    handleSubscription
};

