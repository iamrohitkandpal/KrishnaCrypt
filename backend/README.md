# KrishnaCrypt Backend

Secure tunneling chat application backend with custom encryption and real-time messaging.

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your configuration
# Set MONGODB_URI, JWT_SECRET, etc.

# Start the server
npm start

# For development with auto-reload
npm run dev
```

### Environment Variables

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/krishnacrypt

# JWT Configuration  
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=5000
NODE_ENV=development

# Client Configuration
CLIENT_URL=http://localhost:3000
```

## 🏗️ Architecture

### Core Features
- **Custom Encryption**: Lightweight symmetric encryption with 3-round substitution-permutation network
- **JWT Authentication**: Secure user authentication with bcrypt password hashing
- **Real-time Messaging**: Socket.io with encrypted message tunneling
- **Private Rooms**: SHA-256 hashed room IDs for secure 1-to-1 communication
- **User Management**: Registration, login, online status tracking

### File Structure
```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── middleware/
│   └── auth.js              # JWT authentication
├── models/
│   └── User.js              # User schema with bcrypt
├── routes/
│   └── auth.js              # Authentication endpoints
├── socket/
│   └── socketHandler.js     # Socket.io with encryption
├── utils/
│   └── encryption.js        # Custom encryption module
├── server.js                # Main server file
├── package.json             # Dependencies and scripts
└── .env.example             # Environment template
```

## 🔐 Security Features

### Custom Encryption Algorithm
- **Key Derivation**: SHA-256 from user IDs + server salt
- **Block Cipher**: 128-bit blocks with custom S-box
- **Mode**: CBC with random IV and PKCS#7 padding
- **Rounds**: 3-round substitution-permutation network
- **Transport**: Base64 encoding for message transmission

### Authentication
- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: 24-hour expiration with user payload
- **Socket Authentication**: JWT verification for WebSocket connections
- **Session Management**: Online/offline status tracking

## 📡 API Endpoints

### Authentication Routes (`/api/auth`)

#### POST `/api/auth/register`
Register a new user
```json
{
  "username": "john_doe",
  "password": "securepassword123"
}
```

#### POST `/api/auth/login`
Login user
```json
{
  "username": "john_doe", 
  "password": "securepassword123"
}
```

#### POST `/api/auth/logout`
Logout user (requires JWT token)

#### GET `/api/auth/me`
Get current user profile (requires JWT token)

#### GET `/api/auth/users`
Get all users with online status (requires JWT token)

### Health Check
- `GET /health` - Server health and status
- `GET /api` - API documentation

## 🔌 Socket.io Events

### Client → Server
- `join_room` - Join private chat room
- `private_message` - Send encrypted message
- `decrypt_message` - Request message decryption
- `typing_start/stop` - Typing indicators
- `get_online_users` - Fetch online users

### Server → Client
- `connection_established` - Connection success
- `room_joined` - Room join confirmation
- `new_message` - Incoming encrypted message
- `message_decrypted` - Decryption result
- `user_typing` - Typing indicator
- `online_users` - Online users list
- `user_offline` - User disconnect notification

## 🧪 Testing

### Manual Testing
```bash
# Test encryption module
node -e "
import('./utils/encryption.js').then(enc => {
  console.log(enc.testEncryption());
});
"

# Test server endpoints
curl http://localhost:5000/health
curl http://localhost:5000/api
```

### Integration Testing
1. Start MongoDB: `mongod`
2. Start backend: `npm start`
3. Test registration: POST to `/api/auth/register`
4. Test login: POST to `/api/auth/login`
5. Test Socket.io connection with JWT token

## 🚀 Deployment

### Heroku Deployment
```bash
# Create Heroku app
heroku create krishnacrypt-backend

# Set environment variables
heroku config:set MONGODB_URI=mongodb+srv://...
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production
heroku config:set CLIENT_URL=https://your-frontend.vercel.app

# Deploy
git push heroku main
```

### Render Deployment
1. Connect GitHub repository
2. Set build command: `npm install`
3. Set start command: `npm start`
4. Configure environment variables
5. Deploy

## 🔧 Development

### Scripts
- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests (placeholder)

### Dependencies
- **express** - Web framework
- **socket.io** - Real-time communication
- **mongoose** - MongoDB ODM
- **bcrypt** - Password hashing
- **jsonwebtoken** - JWT authentication
- **cors** - Cross-origin resource sharing
- **dotenv** - Environment variables

## 🛡️ Security Considerations

### Current Implementation
- Custom encryption for demonstration purposes
- JWT tokens with reasonable expiration
- Password hashing with bcrypt
- Input validation and sanitization
- CORS configuration for frontend

### Production Recommendations
- Use industry-standard encryption (AES-256-GCM)
- Implement rate limiting
- Add request logging and monitoring
- Use HTTPS/WSS in production
- Implement proper error handling
- Add comprehensive input validation
- Consider implementing refresh tokens
- Add API versioning

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Make changes with tests
4. Submit pull request

## 📞 Support

For issues and questions:
- Check the logs: `npm start` output
- Verify environment variables
- Ensure MongoDB is running
- Check network connectivity
- Review CORS settings
