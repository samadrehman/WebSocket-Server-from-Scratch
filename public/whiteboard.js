class CollaborativeWhiteboard {
    constructor() {
        this.ws = null;
        this.canvas = document.getElementById('whiteboard-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.drawing = false;
        this.lastX = 0;
        this.lastY = 0;
        this.currentColor = '#000000';
        this.currentBrushSize = 5;
        this.userColor = this.generateUserColor();
        this.drawingHistory = [];
        this.connectedUsers = new Map();
        this.localDrawings = [];
        
        this.initialize();
    }

    initialize() {
        this.setupCanvas();
        this.setupTools();
        this.connectWebSocket();
        this.bindEvents();
    }

    setupCanvas() {
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Set initial background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set line properties
        this.ctx.lineJoin = 'round';
        this.ctx.lineCap = 'round';
    }

    setupTools() {
        // Setup colors
        const colors = [
            '#000000', '#FF3B30', '#FF9500', '#FFCC00',
            '#4CD964', '#5AC8FA', '#007AFF', '#5856D6',
            '#FF2D55', '#8E8E93', '#C7C7CC', '#D1D1D6',
            '#E5E5EA', '#F2F2F7'
        ];
        
        const colorPicker = document.getElementById('color-picker');
        colors.forEach(color => {
            const colorDiv = document.createElement('div');
            colorDiv.className = 'color-option';
            colorDiv.style.backgroundColor = color;
            colorDiv.dataset.color = color;
            
            if (color === this.currentColor) {
                colorDiv.classList.add('active');
            }
            
            colorDiv.addEventListener('click', () => {
                this.selectColor(color);
                document.querySelectorAll('.color-option').forEach(opt => {
                    opt.classList.remove('active');
                });
                colorDiv.classList.add('active');
            });
            
            colorPicker.appendChild(colorDiv);
        });
        
        // Setup brush sizes
        const sizes = [2, 5, 10, 15, 20, 30];
        const brushSizes = document.getElementById('brush-sizes');
        
        sizes.forEach(size => {
            const sizeDiv = document.createElement('div');
            sizeDiv.className = 'brush-size';
            sizeDiv.textContent = size;
            sizeDiv.dataset.size = size;
            
            if (size === this.currentBrushSize) {
                sizeDiv.classList.add('active');
            }
            
            sizeDiv.addEventListener('click', () => {
                this.selectBrushSize(size);
                document.querySelectorAll('.brush-size').forEach(brush => {
                    brush.classList.remove('active');
                });
                sizeDiv.classList.add('active');
            });
            
            brushSizes.appendChild(sizeDiv);
        });
    }

    connectWebSocket() {
        const wsUrl = `ws://${window.location.host}`;
        this.updateStatus('🟡 Connecting...');
        
        this.ws = new WebSocket(wsUrl);
        
        this.ws.onopen = () => {
            this.updateStatus('🟢 Connected');
            
            // Subscribe to draw events
            this.ws.send(JSON.stringify({
                type: 'subscribe',
                data: {
                    channels: ['draw', 'chat']
                }
            }));
            
            // Send join message
            this.ws.send(JSON.stringify({
                type: 'chat',
                data: {
                    message: 'joined the whiteboard',
                    user: 'System'
                }
            }));
        };

        this.ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            } catch (error) {
                console.error('Failed to parse WebSocket message:', error);
            }
        };

        this.ws.onclose = (event) => {
            this.updateStatus('🔴 Disconnected - Reconnecting...');
            this.ws = null;
            // Retry connection after delay
            setTimeout(() => {
                if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
                    this.connectWebSocket();
                }
            }, 3000);
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'draw':
                this.handleDrawingData(message.data);
                break;
                
            case 'chat':
                this.addDrawingHistory(message.data.user, message.data.message);
                break;
                
            case 'system':
                if (message.data.message.includes('Connected')) {
                    this.userId = message.data.clientId;
                }
                break;
        }
    }

    handleDrawingData(data) {
        // Don't draw our own drawings (they're already drawn locally)
        if (data.clientId === this.userId) return;
        
        // Set drawing properties
        this.ctx.strokeStyle = data.color || '#000000';
        this.ctx.lineWidth = data.size || 5;
        
        // Draw the stroke
        this.ctx.beginPath();
        
        if (data.type === 'start') {
            this.ctx.moveTo(data.x, data.y);
        } else if (data.type === 'draw') {
            this.ctx.moveTo(data.fromX, data.fromY);
            this.ctx.lineTo(data.toX, data.toY);
            this.ctx.stroke();
        } else if (data.type === 'end') {
            // Nothing to do on end
        }
        
        // Store in history
        this.addDrawingHistory(
            `User_${data.clientId?.substring(0, 6) || 'unknown'}`,
            `drew with ${data.color}`
        );
    }

    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
        this.canvas.addEventListener('mousemove', (e) => this.draw(e));
        this.canvas.addEventListener('mouseup', () => this.stopDrawing());
        this.canvas.addEventListener('mouseout', () => this.stopDrawing());
        
        // Touch events for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.startDrawing(touch);
        });
        
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            this.draw(touch);
        });
        
        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopDrawing();
        });
        
        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.redrawLocalDrawings();
        });
    }

    startDrawing(e) {
        this.drawing = true;
        const pos = this.getMousePos(e);
        [this.lastX, this.lastY] = [pos.x, pos.y];
        
        // Send start drawing event
        this.sendDrawingData('start', pos.x, pos.y);
        
        // Store locally
        this.localDrawings.push({
            type: 'start',
            x: pos.x,
            y: pos.y,
            color: this.currentColor,
            size: this.currentBrushSize,
            timestamp: Date.now()
        });
    }

    draw(e) {
        if (!this.drawing) return;
        
        e.preventDefault();
        const pos = this.getMousePos(e);
        
        // Draw locally
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.currentBrushSize;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.lastX, this.lastY);
        this.ctx.lineTo(pos.x, pos.y);
        this.ctx.stroke();
        
        // Send drawing data
        this.sendDrawingData('draw', pos.x, pos.y, this.lastX, this.lastY);
        
        // Store locally
        this.localDrawings.push({
            type: 'draw',
            fromX: this.lastX,
            fromY: this.lastY,
            toX: pos.x,
            toY: pos.y,
            color: this.currentColor,
            size: this.currentBrushSize,
            timestamp: Date.now()
        });
        
        [this.lastX, this.lastY] = [pos.x, pos.y];
    }

    stopDrawing() {
        if (!this.drawing) return;
        
        this.drawing = false;
        this.sendDrawingData('end', this.lastX, this.lastY);
        
        this.localDrawings.push({
            type: 'end',
            timestamp: Date.now()
        });
    }

    sendDrawingData(type, x, y, fromX = null, fromY = null) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const drawingData = {
            type: 'draw',
            data: {
                type: type,
                x: x,
                y: y,
                color: this.currentColor,
                size: this.currentBrushSize,
                clientId: this.userId
            }
        };
        
        if (fromX !== null && fromY !== null) {
            drawingData.data.fromX = fromX;
            drawingData.data.fromY = fromY;
            drawingData.data.toX = x;
            drawingData.data.toY = y;
        }
        
        this.ws.send(JSON.stringify(drawingData));
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    selectColor(color) {
        this.currentColor = color;
    }

    selectBrushSize(size) {
        this.currentBrushSize = size;
    }

    clearCanvas() {
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Clear local drawings
        this.localDrawings = [];
        
        // Notify others
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'chat',
                data: {
                    message: 'cleared the canvas',
                    user: 'System'
                }
            }));
        }
        
        this.addDrawingHistory('System', 'Canvas cleared');
    }

    undoLast() {
        if (this.localDrawings.length === 0) return;
        
        // Find and remove last drawing segment
        let lastEndIndex = -1;
        for (let i = this.localDrawings.length - 1; i >= 0; i--) {
            if (this.localDrawings[i].type === 'end') {
                lastEndIndex = i;
                break;
            }
        }
        
        if (lastEndIndex !== -1) {
            // Remove drawings from last segment
            this.localDrawings.splice(lastEndIndex);
            
            // Redraw everything
            this.redrawLocalDrawings();
            
            this.addDrawingHistory('You', 'Undid last drawing');
        }
    }

    redrawLocalDrawings() {
        // Clear canvas
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw all local drawings
        this.localDrawings.forEach(drawing => {
            this.ctx.strokeStyle = drawing.color || '#000000';
            this.ctx.lineWidth = drawing.size || 5;
            
            if (drawing.type === 'start') {
                // Nothing to draw for start
            } else if (drawing.type === 'draw') {
                this.ctx.beginPath();
                this.ctx.moveTo(drawing.fromX, drawing.fromY);
                this.ctx.lineTo(drawing.toX, drawing.toY);
                this.ctx.stroke();
            }
        });
    }

    saveDrawing() {
        const dataUrl = this.canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `whiteboard-${new Date().toISOString().slice(0, 10)}.png`;
        link.href = dataUrl;
        link.click();
        
        this.addDrawingHistory('System', 'Drawing saved as PNG');
    }

    loadPreset() {
        // Load a simple preset drawing
        this.ctx.strokeStyle = '#FF3B30';
        this.ctx.lineWidth = 10;
        
        // Draw a smiley face
        this.ctx.beginPath();
        this.ctx.arc(150, 150, 100, 0, Math.PI * 2); // Face
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(120, 120, 10, 0, Math.PI * 2); // Left eye
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(180, 120, 10, 0, Math.PI * 2); // Right eye
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(150, 150, 60, 0, Math.PI); // Smile
        this.ctx.stroke();
        
        this.addDrawingHistory('System', 'Loaded preset drawing');
    }

    addDrawingHistory(user, action) {
        const historyDiv = document.getElementById('drawing-history');
        const historyItem = document.createElement('div');
        
        const time = new Date().toLocaleTimeString();
        historyItem.className = 'history-item';
        historyItem.textContent = `[${time}] ${user} ${action}`;
        
        historyDiv.appendChild(historyItem);
        historyDiv.scrollTop = historyDiv.scrollHeight;
        
        // Keep only last 50 items
        if (historyDiv.children.length > 50) {
            historyDiv.removeChild(historyDiv.firstChild);
        }
    }

    updateStatus(text) {
        const statusEl = document.getElementById('whiteboard-status');
        statusEl.textContent = text;
        
        if (text.includes('Connected')) {
            statusEl.className = 'connection-status connected';
        } else if (text.includes('Disconnected')) {
            statusEl.className = 'connection-status disconnected';
        } else {
            statusEl.className = 'connection-status';
        }
    }

    generateUserColor() {
        const colors = [
            '#FF3B30', '#FF9500', '#FFCC00', '#4CD964',
            '#5AC8FA', '#007AFF', '#5856D6', '#FF2D55'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }
}

// Initialize whiteboard when page loads
let whiteboard;
window.addEventListener('DOMContentLoaded', () => {
    whiteboard = new CollaborativeWhiteboard();
});

// Global functions for button clicks
function clearCanvas() {
    if (whiteboard) whiteboard.clearCanvas();
}

function undoLast() {
    if (whiteboard) whiteboard.undoLast();
}

function saveDrawing() {
    if (whiteboard) whiteboard.saveDrawing();
}

function loadPreset() {
    if (whiteboard) whiteboard.loadPreset();
}