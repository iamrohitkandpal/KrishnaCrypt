# KrishnaCrypt Frontend - React Chat Application

A bare-bones React frontend for the KrishnaCrypt secure tunneling chat application with cybersecurity-focused features.

## 🚀 Quick Start

### Prerequisites
- Node.js (v16+)
- KrishnaCrypt backend server running on port 5000

### Local Development

1. **Install dependencies:**
```bash
cd frontend
npm install
```

2. **Environment setup (optional):**
```bash
# Create .env file for custom backend URL
echo "REACT_APP_API_URL=http://localhost:5000" > .env
echo "REACT_APP_SOCKET_URL=http://localhost:5000" >> .env
```

3. **Start development server:**
```bash
npm start
```

The app will open at `http://localhost:3000`

### Production Build
```bash
npm run build
```

## 🏗️ Architecture

### Components Structure
```
src/
├── components/
│   ├── Login.js          # Authentication (login/register)
│   ├── UserList.js       # Display online users
│   └── Chat.js           # Message interface with encryption debug
├── services/
│   ├── api.js            # REST API calls
│   └── socket.js         # Socket.io client service
├── App.js                # Main application logic
└── index.css             # Minimal styling
```

### Key Features
- **Authentication**: Login/Register with JWT tokens
- **Real-time Messaging**: Socket.io integration
- **Encryption Debug**: View base64 encrypted payloads
- **User Presence**: Online/offline status tracking
- **Mobile Responsive**: Basic responsive design

## 🔐 Cybersecurity Demo Features

### 1. Encryption Visibility
- **Debug Panel**: Click 🔍 button in chat to see encryption logs
- **Base64 Payloads**: View encrypted message data
- **Algorithm Info**: Shows custom lightweight encryption details

### 2. Secure Tunneling
- **Room IDs**: SHA-256 hashed user pair identifiers
- **VPN-like Flow**: Server-side encrypt → tunnel → decrypt
- **Connection Status**: Real-time tunnel status indicator

### 3. Security Indicators
- 🔒 Encryption status in chat header
- 🛡️ Secure tunnel established notifications
- 🔐 End-to-end encryption badges

## 📡 API Integration

### REST Endpoints
```javascript
// Authentication
POST /api/auth/register  // Register new user
POST /api/auth/login     // User login
GET  /api/auth/me        // Get profile
GET  /api/auth/users     // Get user list
POST /api/auth/logout    // Logout
```

### Socket.io Events
```javascript
// Client → Server
join_room(targetUserId)           // Join private room
private_message(recipientId, msg) // Send encrypted message
decrypt_message(encryptedData)    // Request decryption
typing_start/stop(recipientId)    // Typing indicators

// Server → Client
encrypted_message(data)    // Receive encrypted payload
decrypted_message(data)    // Receive decrypted text
room_joined(roomData)      // Room join confirmation
online_users(users)        // User presence updates
```

## 🌐 Deployment

### Vercel Deployment (Frontend)

1. **Install Vercel CLI:**
```bash
npm i -g vercel
```

2. **Deploy:**
```bash
cd frontend
vercel --prod
```

3. **Environment Variables:**
Set in Vercel dashboard:
- `REACT_APP_API_URL`: Your backend URL (e.g., https://your-app.herokuapp.com)
- `REACT_APP_SOCKET_URL`: Same as API URL for Socket.io

### Heroku Backend Setup
Ensure your backend is deployed first:
```bash
# In backend directory
heroku create your-krishnacrypt-backend
git push heroku main
```

### Local Testing Setup

1. **Terminal 1 - Backend:**
```bash
cd /path/to/krishnacrypt
npm install
npm start
# Server runs on http://localhost:5000
```

2. **Terminal 2 - Frontend:**
```bash
cd frontend
npm install
npm start
# App opens at http://localhost:3000
```

3. **Terminal 3 - MongoDB (if local):**
```bash
mongod
# Or use MongoDB Atlas connection string
```

## 🧪 Manual Testing Plan

### Test Scenario 1: User Registration & Authentication
1. Open `http://localhost:3000`
2. Click "Need an account? Register"
3. Register with username: `alice`, password: `password123`
4. Login with same credentials
5. ✅ Should see user list interface

### Test Scenario 2: Two-User Encrypted Chat
1. **Setup Two Browser Sessions:**
   - Browser 1: Register/login as `alice`
   - Browser 2: Register/login as `bob` (incognito/different browser)

2. **Initiate Chat:**
   - In Alice's browser: Click on "bob" in user list
   - Should see "Secure tunnel established" message
   - Room ID should appear in chat header

3. **Send Encrypted Messages:**
   - Alice sends: "Hello Bob! This is encrypted!"
   - Bob sends: "Hi Alice! I can see your message!"
   - ✅ Messages should appear in both browsers

4. **Verify Encryption (Debug Mode):**
   - Click 🔍 debug button in chat
   - Send a message
   - ✅ Should see base64 encrypted payload in debug log
   - ✅ Should see decryption request and result

### Test Scenario 3: Cybersecurity Demo
1. **Show Encrypted Payloads:**
   - Open browser dev tools (F12)
   - Go to Network tab
   - Send messages and observe WebSocket frames
   - ✅ Should see base64 encrypted data

2. **Demonstrate Tunneling:**
   - Point out room ID generation (SHA-256 hash)
   - Show server-side encryption/decryption flow
   - Explain VPN-like tunneling concept

3. **Security Features:**
   - User isolation (can't decrypt others' messages)
   - Unique keys per user pair
   - Random IV per message

### Test Scenario 4: Connection Handling
1. **Test Reconnection:**
   - Stop backend server
   - ✅ Should show "Disconnected" status
   - Restart server
   - ✅ Should reconnect automatically

2. **Test Multiple Users:**
   - Add third user `charlie`
   - ✅ All users should see each other in list
   - ✅ Each pair should have separate encrypted rooms

## 🔧 Configuration

### Environment Variables
```bash
# Frontend (.env)
REACT_APP_API_URL=http://localhost:5000
REACT_APP_SOCKET_URL=http://localhost:5000

# Production
REACT_APP_API_URL=https://your-backend.herokuapp.com
REACT_APP_SOCKET_URL=https://your-backend.herokuapp.com
```

### Proxy Configuration
The `package.json` includes a proxy for development:
```json
"proxy": "http://localhost:5000"
```

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors:**
   - Ensure backend CORS is configured for `http://localhost:3000`
   - Check `CLIENT_URL` environment variable in backend

2. **Socket Connection Failed:**
   - Verify backend is running on port 5000
   - Check browser console for WebSocket errors
   - Ensure JWT token is valid

3. **Messages Not Appearing:**
   - Check debug panel for encryption/decryption logs
   - Verify users are in the same room
   - Check backend logs for encryption errors

4. **Build Errors:**
   - Clear node_modules: `rm -rf node_modules && npm install`
   - Check Node.js version compatibility

### Debug Tips
- Use the 🔍 debug panel to monitor encryption flow
- Check browser dev tools Network tab for API calls
- Monitor WebSocket frames for real-time events
- Backend logs show detailed encryption operations

## 📝 Implementation Notes

### Security Considerations
- **Frontend Security**: JWT tokens stored in localStorage (demo only)
- **HTTPS Required**: For production deployment
- **Input Validation**: Basic client-side validation implemented
- **XSS Protection**: React's built-in XSS protection

### Performance
- **Message Limit**: No pagination implemented (demo purposes)
- **Memory Usage**: Debug logs limited to 20 entries
- **Reconnection**: Automatic Socket.io reconnection enabled

### Browser Compatibility
- Modern browsers with WebSocket support
- ES6+ features used (requires recent browsers)
- No IE support (uses modern JavaScript)

## 📚 Demo Script

### 5-Minute Cybersecurity Demo
1. **Introduction** (1 min):
   - "KrishnaCrypt demonstrates custom encryption in web apps"
   - Show clean, functional interface

2. **Registration & Setup** (1 min):
   - Register two users in different browsers
   - Show user list and online status

3. **Encrypted Messaging** (2 min):
   - Start chat between users
   - Enable debug panel
   - Send messages and show base64 encrypted payloads
   - Explain server-side encryption/decryption

4. **Security Features** (1 min):
   - Point out room ID hashing
   - Explain VPN-like tunneling
   - Show connection status and security indicators

Total implementation time: ~6 hours as requested.
