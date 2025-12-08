# 🚀 Advanced Web Server with WebSocket Support

A production-ready, feature-rich HTTP/WebSocket server built from scratch with Node.js. This project demonstrates advanced server architecture, real-time communication, and modern web development practices.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![License](https://img.shields.io/badge/License-MIT-blue)
![WebSocket](https://img.shields.io/badge/WebSocket-Enabled-brightgreen)

## ✨ Features

### Core Server Features
- **Custom HTTP Server** - Built from scratch using Node.js native `http` module
- **Dynamic Routing System** - Flexible router supporting GET, POST, PUT, DELETE, PATCH with parameter extraction
- **Static File Serving** - Efficient serving of HTML, CSS, JavaScript, and media files
- **Request Logging** - Comprehensive request logging with timestamps
- **JSON API Endpoints** - RESTful API with JSON responses
- **Error Handling** - Graceful error handling with proper HTTP status codes

### Real-Time WebSocket Features
- **Bidirectional Communication** - Real-time messaging between server and clients
- **Live Chat Room** - Multi-user chat with instant message broadcasting
- **Server Metrics Dashboard** - Real-time monitoring of requests, connections, and performance
- **Collaborative Whiteboard** - Shared drawing canvas with real-time synchronization
- **Connection Management** - Heartbeat mechanism for connection health monitoring
- **Selective Subscriptions** - Clients can subscribe to specific event types (chat, metrics, draw)
- **Automatic Reconnection** - Client-side reconnection handling

### Advanced Features
- **Request Rate Calculation** - Real-time requests-per-second tracking with thread-safe operations
- **Connection Pooling** - Efficient WebSocket connection management with connection limits (max 1000)
- **Graceful Shutdown** - Clean server shutdown with connection cleanup
- **Security Features** - Comprehensive security implementation:
  - Path traversal protection in file uploads
  - Input validation and sanitization (XSS, SQL injection prevention)
  - Memory leak prevention in all components
  - File upload validation with magic number checking
  - CORS headers on all endpoints
  - Safe error messages (no stack traces in production)
- **Performance Optimizations**:
  - Async, non-blocking WebSocket broadcasts
  - Smart static file caching (1 year for assets, no-cache for dynamic content)
  - Connection heartbeat with timeout handling
  - Memory-efficient operations with automatic cleanup
- **Scalable Architecture** - Modular design for easy extension

## 🏗️ Architecture

```
Web Server/
├── src/
│   ├── server.js              # Main server class
│   ├── websocket/
│   │   ├── server.js          # WebSocket server setup
│   │   └── handlers.js        # WebSocket message handlers
│   ├── utils/
│   │   ├── router.js          # Custom routing system
│   │   └── staticHandler.js   # Static file serving
│   └── middleware/            # Middleware modules
├── public/                    # Frontend files
│   ├── index.html            # Main landing page
│   ├── websocket-demo.html   # WebSocket demo
│   ├── whiteboard.html       # Collaborative whiteboard
│   └── *.js, *.css           # Client-side scripts
└── package.json
```

 🚀 Getting Started

Prerequisites

- Node.js 14.0.0 or higher
- npm or yarn package manager

 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "Web server"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

   Or for development with auto-reload:
   ```bash
   npm run dev
   ```

4. **Access the application**
   - Main page: http://localhost:3000
   - WebSocket Demo: http://localhost:3000/websocket-demo
   - Whiteboard: http://localhost:3000/whiteboard
   - API Stats: http://localhost:3000/api/stats

## 📖 Usage

### HTTP Endpoints

#### GET `/`
Serves the main landing page with feature showcase.

#### GET `/websocket-demo`
Interactive WebSocket demonstration page with chat and metrics.

#### GET `/whiteboard`
Collaborative whiteboard for real-time drawing.

#### GET `/api/stats`
Returns server statistics in JSON format:
```json
{
  "server": {
    "totalRequests": 1234,
    "activeConnections": 5,
    "requestsPerSecond": 12,
    "uptime": 3600
  },
  "webSocket": {
    "connections": 3,
    "uptime": 3600
  },
  "system": {
    "nodeVersion": "v18.0.0",
    "platform": "win32",
    "memory": "45MB"
  }
}
```

### WebSocket Protocol

#### Connection
Connect to `ws://localhost:3000` (or `wss://` for secure connections).

#### Message Types

**1. Chat Message**
```json
{
  "type": "chat",
  "data": {
    "message": "Hello, world!",
    "from": "Username"
  }
}
```

**2. Drawing Event**
```json
{
  "type": "draw",
  "data": {
    "action": "draw",
    "x": 100,
    "y": 200,
    "color": "#000000",
    "size": 5
  }
}
```

**3. Subscription**
```json
{
  "type": "subscribe",
  "data": {
    "channels": ["chat", "metrics", "draw"]
  }
}
```

**4. Ping**
```json
{
  "type": "ping"
}
```

#### Server Messages

**System Message**
```json
{
  "type": "system",
  "data": {
    "message": "Connected to WebSocket server",
    "clientId": "abc123",
    "timestamp": "2024-01-01T00:00:00.000Z",
    "activeConnections": 5
  }
}
```

**Metrics Update**
```json
{
  "type": "metrics",
  "data": {
    "totalRequests": 1234,
    "activeConnections": 5,
    "requestsPerSecond": 12,
    "uptime": 3600
  }
}
```

**Chat Message**
```json
{
  "type": "chat",
  "data": {
    "from": "Username",
    "message": "Hello, world!",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

## 🛠️ Technology Stack

- **Runtime**: Node.js
- **Core Modules**: `http`, `fs`, `path`, `url`
- **WebSocket**: `ws` library
- **Development**: `nodemon` for auto-reload

## 📁 Project Structure

```
Web server/
├── src/
│   ├── server.js                 # Main server implementation
│   ├── websocket/
│   │   ├── server.js             # WebSocket server setup
│   │   └── handlers.js           # Message handlers
│   ├── utils/
│   │   ├── router.js             # Custom router
│   │   ├── staticHandler.js      # Static file handler
│   │   └── uploadHandler.js      # File upload handler
│   ├── middleware/
│   │   ├── validation.js         # Input validation
│   │   └── sanitize.js           # Input sanitization
│   └── validation/
│       └── schemas.js            # Validation schemas
├── public/                        # Frontend files
│   ├── index.html
│   ├── websocket-demo.html
│   ├── whiteboard.html
│   └── *.js, *.css
├── uploads/                       # Uploaded files directory
├── package.json
└── README.md
```



### Project Features
- ✅ Built from scratch without frameworks (Express, etc.)
- ✅ Real-time bidirectional communication with WebSocket
- ✅ Production-ready architecture with security best practices
- ✅ Clean, maintainable code structure
- ✅ Comprehensive documentation
- ✅ Multiple interactive demos (Chat, Whiteboard, Metrics)
- ✅ **Security Hardened**: All critical, high, and medium priority security issues resolved
- ✅ **Performance Optimized**: Async operations, smart caching, memory management
- ✅ **Error Resilient**: Proper error handling, reconnection logic, graceful degradation

## 🔧 Configuration

### Environment Variables

- `PORT` - Server port (default: 3000)

Example:
```bash
PORT=8080 npm start
```

## 🧪 Testing

Open multiple browser tabs to test:
1. **WebSocket Chat**: Send messages and see them appear in all connected clients
2. **Metrics Dashboard**: Watch real-time server statistics
3. **Whiteboard**: Draw collaboratively with other users

## 🔒 Security Features

This project implements comprehensive security measures:

### Critical Security Fixes
- ✅ **WebSocket Heartbeat Cleanup**: Proper interval cleanup on disconnect to prevent memory leaks
- ✅ **Race Condition Prevention**: Thread-safe request metrics with locking mechanism
- ✅ **Path Traversal Protection**: File upload paths validated before operations, preventing directory traversal attacks
- ✅ **Memory Leak Prevention**: All components with proper cleanup and memory management

### High Priority Security Features
- ✅ **Async WebSocket Broadcasts**: Non-blocking message broadcasting prevents slow client blocking
- ✅ **Connection Limits**: Maximum 1000 WebSocket connections to prevent resource exhaustion
- ✅ **Validation Consistency**: All endpoints use consistent validation schemas
- ✅ **Smart Caching**: Static assets cached for 1 year, dynamic content not cached

### Medium Priority Security Features
- ✅ **Safe Error Messages**: Stack traces only shown in development mode (NODE_ENV check)
- ✅ **Subscription Validation**: WebSocket subscription channels validated against whitelist
- ✅ **File Upload Race Condition**: File locking mechanism prevents race conditions during uploads
- ✅ **CORS Headers**: Consistent CORS headers on all endpoints

### Security Best Practices Implemented
- Input sanitization (XSS prevention)
- SQL injection pattern detection
- File type validation using magic numbers
- Rate limiting with DoS protection
- Path traversal attack prevention
- Memory leak prevention
- Connection management and limits
- Error message sanitization

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**: 
   - Set `PORT` for production
   - Set `NODE_ENV=production` to disable debug information
2. **HTTPS/WSS**: Use reverse proxy (nginx) for SSL termination
3. **Process Manager**: Use PM2 or similar for process management
4. **Logging**: Implement proper logging service (Winston, Pino, etc.)
5. **Monitoring**: Add application monitoring (e.g., New Relic, DataDog)
6. **Security**: 
   - Configure connection limits based on server capacity
   - Configure CORS origins (replace `*` with specific domains)
   - Set up file upload size limits based on requirements
   - Configure WebSocket connection limits based on server capacity

### Example PM2 Configuration

```json
{
  "name": "web-server",
  "script": "src/server.js",
  "instances": 2,
  "exec_mode": "cluster",
  "env": {
    "PORT": 3000,
    "NODE_ENV": "production"
  }
}
```

## 📋 Summary of Fixes and Improvements

### All Issues Resolved ✅

This project has been thoroughly reviewed and all security, performance, and reliability issues have been addressed:

#### Critical Issues Fixed
1. **WebSocket Heartbeat Memory Leaks** - Proper interval cleanup on disconnect
2. **Race Conditions in Metrics** - Thread-safe operations with locking
3. **File Upload Path Validation** - Path traversal protection before file operations
4. **Memory Management** - Proper cleanup and memory leak prevention in all components

#### High Priority Issues Fixed
1. **WebSocket Broadcast Performance** - Async, non-blocking broadcasts
2. **Connection Limits** - Maximum 1000 connections with proper handling
3. **Validation Consistency** - All endpoints use validation schemas
4. **Static File Caching** - Smart caching (1 year for assets, no-cache for dynamic)

#### Medium Priority Issues Fixed
1. **Error Message Safety** - Stack traces only in development mode
2. **Subscription Logic** - Opt-in subscriptions with channel validation
3. **File Upload Race Conditions** - File locking mechanism
4. **CORS Headers** - Consistent CORS on all endpoints

#### WebSocket Connection Issues Fixed
- Fixed WebSocket upgrade path handling
- Improved client-side reconnection logic
- Added proper error handling in client code
- Fixed subscription initialization

## 📄 License

MIT License - feel free to use this project for learning and portfolio purposes.

See [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Node.js and WebSocket technology
- Inspired by modern web server architectures
- Designed for learning and portfolio demonstration

---

⭐ **Star this repo if you find it helpful!**

📧 **Questions?** Open an issue or reach out!

