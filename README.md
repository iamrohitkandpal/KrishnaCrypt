# KrishnaCrypt - Secure Friend-Based Chat Application

A cybersecurity-focused real-time chat application with end-to-end encryption, VPN-like tunneling, and secure friend-based messaging capabilities.

## Features

- **Friend-Based Messaging**: Users can only chat with added friends
- **Unique Secret IDs**: Each user gets a unique secret ID for friend discovery
- **End-to-End Encryption**: Custom lightweight symmetric encryption algorithm
- **VPN-like Tunneling**: Server-side message encryption/decryption simulation
- **Real-time Messaging**: Socket.io powered instant communication
- **JWT Authentication**: Secure user authentication with bcrypt password hashing
- **Private Rooms**: SHA-256 hashed secure communication channels
- **User Presence**: Online/offline status tracking for friends only
- **Cybersecurity Demo**: Visible encryption processes for educational purposes

## Architecture

### Backend (Node.js)
- Express.js REST API
- Socket.io for real-time communication
- MongoDB with Mongoose ODM
- Custom encryption module
- JWT authentication middleware
- Friend relationship management

### Frontend (React.js)
- React functional components
- Socket.io client integration
- Axios for API calls
- Responsive CSS design
- Debug panel for encryption visibility
- Friend management interface

## Security Implementation

### Custom Encryption Algorithm
- **Algorithm**: 3-round substitution-permutation network
- **Key Size**: 128-bit derived from user IDs + server salt
- **Block Size**: 128-bit (16 bytes)
- **Mode**: CBC with random IV
- **Padding**: PKCS#7
- **Transport**: Base64 encoding

### Security Features
- Bcrypt password hashing (12 salt rounds)
- JWT tokens with 24-hour expiration
- Secure room ID generation (SHA-256)
- Input validation and sanitization
- CORS configuration
- Friend-based access control

## Installation & Setup

### Prerequisites
- Node.js 16+
- MongoDB (local or Atlas)
- npm or yarn

### Backend Setup
```bash
# Clone repository
git clone <repository-url>
cd krishna-crypt

# Navigate to backend directory
cd backend

# Install backend dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your MongoDB URI and JWT secret

# Start MongoDB (if local)
mongod

# Start backend server
npm start
```

### Frontend Setup
```bash
# Navigate to frontend directory (from project root)
cd frontend

# Install frontend dependencies
npm install

# Setup environment variables
# Create .env file with:
# REACT_APP_API_URL=http://localhost:5432
# REACT_APP_SOCKET_URL=http://localhost:5432

# Start React development server
npm start
```

## Environment Variables

### Backend (backend/.env)
```env
MONGODB_URI=mongodb://localhost:27017/krishnacrypt
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
PORT=5432
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

### Frontend (frontend/.env)
```env
REACT_APP_API_URL=http://localhost:5432
REACT_APP_SOCKET_URL=http://localhost:5432
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - User registration (returns secretId)
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get user profile with friends list
- `GET /api/auth/friends` - Get user's friends list
- `POST /api/auth/add-friend` - Add friend by secret ID

### Health Check
- `GET /health` - Server health status
- `GET /api` - API documentation

## Socket.io Events

### Client Events
- `join_room` - Join private chat room (friend validation required)
- `private_message` - Send encrypted message to friend
- `typing_start/stop` - Typing indicators
- `get_online_friends` - Fetch online friends

### Server Events
- `new_message` - Incoming encrypted message from friend
- `user_typing` - Typing indicator from friend
- `online_friends` - Online friends list
- `connection_established` - Connection success

## Friend System

### How It Works
1. **Registration**: Users get a unique secret ID upon registration
2. **Secret ID Sharing**: Users copy and share their secret ID with others
3. **Adding Friends**: Users enter others' secret IDs to add them as friends
4. **Messaging**: Users can only chat with their friends when both are online
5. **Privacy**: Friend relationships are private and stored securely

### Secret ID Format
- Generated using `crypto.randomUUID()`
- Format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- Example: `f47ac10b-58cc-4372-a567-0e02b2c3d479`

## Testing

### Manual Testing
1. Register two users and note their secret IDs
2. Login with both accounts
3. Add each other as friends using secret IDs
4. Start a conversation when both are online
5. Observe encrypted messages in debug panel
6. Verify message decryption
7. Test typing indicators
8. Test connection resilience

### Friend System Testing
```bash
# Test friend addition
curl -X POST http://localhost:5432/api/auth/add-friend \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"secretId":"friend-secret-id-here"}'
```

### Encryption Testing
```bash
# Test encryption module (from backend directory)
cd backend
node -e "
import('./utils/encryption.js').then(enc => {
  console.log(enc.testEncryption());
});
"
```

## Deployment

### Backend Deployment (Heroku/Render)
```bash
# From backend directory
heroku create krishnacrypt-backend

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret-key
heroku config:set MONGODB_URI=your-mongodb-uri

# Deploy
git push heroku main
```

## 🧪 Testing

### Manual Testing with curl

**Register User:**
```bash
curl -X POST http://localhost:5432/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

**Login:**
```bash
curl -X POST http://localhost:5432/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"password123"}'
```

**Add Friend:**
```bash
curl -X POST http://localhost:5432/api/auth/add-friend \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"secretId":"friend-secret-id"}'
```

**Get Friends:**
```bash
curl -X GET http://localhost:5432/api/auth/friends \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Health Check:**
```bash
curl http://localhost:5432/health
```

## 🔧 Configuration Options

- **MongoDB**: Supports both local MongoDB and MongoDB Atlas
- **CORS**: Configured for React frontend on port 3000
- **JWT**: 24-hour expiration by default
- **Encryption**: Custom 128-bit algorithm with random IVs
- **Password Hashing**: bcrypt with 12 salt rounds
- **Secret IDs**: UUID v4 format for friend discovery

## 📝 Notes

- Built with function-based architecture (no classes)
- Friend-based access control for enhanced privacy
- Optimized for quick setup (under 4 hours)
- Minimal dependencies for reduced overhead
- Production-ready with proper error handling
- Supports graceful shutdown and connection cleanup

## 🤝 Frontend Integration

The server is designed to work with React frontends. Key integration points:

1. **Authentication**: Store JWT token from login response
2. **Friend Management**: Display secret ID, allow copying, handle friend addition
3. **Socket Connection**: Pass JWT token in Socket.io handshake auth
4. **Message Flow**: Send plain messages to friends, receive encrypted, request decryption
5. **Room Management**: Use friend relationships to generate consistent room IDs

## 📄 License

MIT License - feel free to use for learning and development purposes.
