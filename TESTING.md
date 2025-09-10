# KrishnaCrypt Manual Testing Plan

## 🧪 Comprehensive Testing Guide for Encrypted Messaging Demo

### Prerequisites
- MongoDB running (local or Atlas)
- Backend server running on port 5000
- Frontend running on port 3000
- Two different browsers or incognito windows

## Test Suite 1: Authentication & Setup (15 minutes)

### Test 1.1: User Registration
**Objective**: Verify user registration with validation

**Steps**:
1. Open `http://localhost:3000`
2. Click "Need an account? Register"
3. Try invalid inputs:
   - Username: `ab` (too short) → Should show error
   - Password: `123` (too short) → Should show error
4. Register valid user:
   - Username: `alice`
   - Password: `password123`
5. ✅ Should show "Registration successful" message
6. Should automatically switch to login form

**Expected Results**:
- Form validation works correctly
- Successful registration message appears
- User can proceed to login

### Test 1.2: User Login
**Objective**: Verify JWT authentication flow

**Steps**:
1. Login with registered credentials
2. ✅ Should redirect to chat interface
3. Should see "Welcome, alice" in header
4. Should see connection status: "🟢 Connected"
5. Check browser localStorage for `authToken`

**Expected Results**:
- JWT token stored in localStorage
- Socket connection established
- User interface loads correctly

### Test 1.3: Multiple User Setup
**Objective**: Create test users for messaging

**Steps**:
1. **Browser 1**: Register/login as `alice`
2. **Browser 2** (incognito): Register/login as `bob`
3. **Browser 3** (different browser): Register/login as `charlie`

**Expected Results**:
- All users can register and login independently
- Each user sees others in the user list
- Online status indicators work

## Test Suite 2: Encrypted Messaging (20 minutes)

### Test 2.1: Basic Message Exchange
**Objective**: Verify end-to-end encrypted messaging

**Steps**:
1. **Alice's browser**: Click on "bob" in user list
2. ✅ Should see "Secure tunnel established" message
3. ✅ Room ID should appear in chat header (e.g., "Room: a1b2c3d4...")
4. **Alice sends**: "Hello Bob! This is my first encrypted message!"
5. **Bob's browser**: Should automatically show Alice in chat
6. **Bob sends**: "Hi Alice! I received your encrypted message!"
7. **Alice sends**: "Great! The encryption is working! 🔐"

**Expected Results**:
- Messages appear in both browsers instantly
- Timestamps are accurate
- Message bubbles show correct sender
- Encryption status shows "Secure tunnel established"

### Test 2.2: Encryption Debug Analysis
**Objective**: Demonstrate encryption visibility for cybersecurity demo

**Steps**:
1. **In Alice's chat**: Click 🔍 debug button
2. **Send message**: "This message will show encryption details"
3. **Observe debug panel**:
   - ✅ Should show "Sending message" log
   - ✅ Should show "Received encrypted message" log
   - ✅ Should display base64 IV and encrypted payload
   - ✅ Should show "Message decrypted and displayed" log

**Debug Panel Should Show**:
```
[14:30:15] Sending message
{
  "recipient": "bob",
  "messageLength": 42,
  "roomId": "a1b2c3d4..."
}

[14:30:15] Received encrypted message
{
  "algorithm": "custom-lightweight-128",
  "iv": "dGVzdGl2MTIzNDU2Nzg=",
  "encryptedLength": 64,
  "sender": "alice"
}

[14:30:15] Message decrypted and displayed
{
  "messageLength": 42,
  "sender": "alice"
}
```

### Test 2.3: Multi-User Room Isolation
**Objective**: Verify message encryption isolation between different user pairs

**Steps**:
1. **Alice ↔ Bob conversation**:
   - Alice sends: "Secret message for Bob only"
   - Verify Bob receives it
2. **Alice ↔ Charlie conversation**:
   - Alice clicks on "charlie" in user list
   - ✅ Should create NEW room with different Room ID
   - Alice sends: "Different secret for Charlie"
   - Verify Charlie receives it, Bob does NOT
3. **Bob ↔ Charlie conversation**:
   - Bob clicks on "charlie"
   - ✅ Should create THIRD unique room
   - Bob sends: "Bob to Charlie direct"
   - Verify Charlie receives it, Alice does NOT

**Expected Results**:
- Each user pair has unique Room ID (SHA-256 hash)
- Messages are isolated between different conversations
- No cross-talk between different encrypted tunnels

## Test Suite 3: Real-Time Features (10 minutes)

### Test 3.1: Typing Indicators
**Objective**: Test real-time typing notifications

**Steps**:
1. **Alice's browser**: Start typing in message input
2. **Bob's browser**: Should see "alice is typing..." indicator
3. **Alice**: Stop typing for 1 second
4. **Bob**: Typing indicator should disappear
5. **Bob**: Start typing
6. **Alice**: Should see "bob is typing..." indicator

**Expected Results**:
- Typing indicators appear/disappear correctly
- No delay or lag in real-time updates

### Test 3.2: User Presence
**Objective**: Verify online/offline status tracking

**Steps**:
1. **All browsers**: Verify green online indicators next to usernames
2. **Close Bob's browser**
3. **Alice & Charlie**: Should see Bob go offline (no green indicator)
4. **Reopen Bob's browser and login**
5. **Alice & Charlie**: Should see Bob come back online

**Expected Results**:
- Online status updates in real-time
- User list reflects accurate presence information

## Test Suite 4: Cybersecurity Demo (15 minutes)

### Test 4.1: Network Traffic Analysis
**Objective**: Show encrypted payloads in network traffic

**Steps**:
1. **Open browser dev tools** (F12)
2. **Go to Network tab**
3. **Filter by WS (WebSocket)**
4. **Send a message**: "Demo message for network analysis"
5. **Click on WebSocket frames**
6. ✅ Should see base64 encoded encrypted data
7. ✅ Should NOT see plaintext message in network traffic

**What to Look For**:
```json
{
  "roomId": "a1b2c3d4e5f6...",
  "senderId": "user123",
  "recipientId": "user456", 
  "iv": "dGVzdGl2MTIzNDU2Nzg=",
  "encrypted": "U2FsdGVkX1+vupppZksvRf5pq5g5XjFRIipRkwB0K1Y=",
  "algorithm": "custom-lightweight-128",
  "timestamp": "2024-01-15T14:30:15.123Z"
}
```

### Test 4.2: Room ID Generation Demo
**Objective**: Explain SHA-256 room hashing for security

**Steps**:
1. **Show Room IDs** in chat headers for different conversations:
   - Alice ↔ Bob: Room ID `abc123...`
   - Alice ↔ Charlie: Room ID `def456...`
   - Bob ↔ Charlie: Room ID `ghi789...`
2. **Explain**: Room ID = SHA-256(sorted(userA_id, userB_id))
3. **Demonstrate**: Same user pair always gets same room ID
4. **Security**: Impossible to guess other users' room IDs

### Test 4.3: Encryption Algorithm Demo
**Objective**: Explain custom lightweight encryption

**Steps**:
1. **Open debug panel** and send test message
2. **Explain algorithm components**:
   - 128-bit key derived from user IDs + server salt
   - 3-round substitution-permutation network
   - Custom S-box for byte substitution
   - Row shifting and matrix mixing
   - CBC mode with random IV
   - Base64 encoding for transport

3. **Security properties**:
   - Unique keys per user pair
   - Random IV prevents pattern recognition
   - Server-side tunneling (VPN-like)
   - No plaintext storage

## Test Suite 5: Error Handling & Edge Cases (10 minutes)

### Test 5.1: Connection Resilience
**Objective**: Test reconnection and error handling

**Steps**:
1. **Stop backend server** (Ctrl+C in server terminal)
2. **Frontend should show**: "🔴 Disconnected from server"
3. **Try sending message**: Should show error or disable input
4. **Restart backend server**
5. ✅ Should automatically reconnect
6. ✅ Should show "🟢 Connected" status
7. **Send message**: Should work normally after reconnection

### Test 5.2: Input Validation
**Objective**: Test message input limits and validation

**Steps**:
1. **Try empty message**: Send button should be disabled
2. **Try very long message** (1000+ characters): Should be truncated or show warning
3. **Try special characters**: "Hello! 🔐 Special chars: @#$%^&*()"
4. ✅ Should handle all characters correctly

### Test 5.3: Browser Compatibility
**Objective**: Test across different browsers

**Steps**:
1. **Test in Chrome**: Full functionality
2. **Test in Firefox**: Full functionality  
3. **Test in Safari** (if available): Full functionality
4. **Test mobile browser**: Basic responsive design

## Test Suite 6: Performance & Scalability (5 minutes)

### Test 6.1: Message History
**Objective**: Test message persistence and display

**Steps**:
1. **Send 20+ messages** between Alice and Bob
2. **Scroll up in chat**: Should show all messages
3. **Refresh browser**: Messages should persist (or clear, depending on implementation)
4. **Check memory usage**: Debug panel should limit logs to 20 entries

### Test 6.2: Multiple Concurrent Chats
**Objective**: Test switching between conversations

**Steps**:
1. **Alice**: Send messages to both Bob and Charlie
2. **Switch between conversations**: Should maintain separate message histories
3. **Verify isolation**: Messages don't leak between chats
4. **Check performance**: No lag when switching

## 🎯 Demo Script for Presentations (5 minutes)

### Minute 1: Introduction
- "KrishnaCrypt demonstrates custom encryption in real-world web applications"
- Show clean, professional interface
- Highlight cybersecurity focus

### Minute 2: User Setup
- Register two users in different browsers
- Show user list and online status
- Explain user isolation and authentication

### Minute 3: Encrypted Messaging
- Start conversation between users
- Send messages and show real-time delivery
- Enable debug panel to show encryption

### Minute 4: Security Deep Dive
- Point out base64 encrypted payloads in debug panel
- Explain room ID generation (SHA-256 hashing)
- Show network traffic with encrypted data
- Explain VPN-like server-side tunneling

### Minute 5: Advanced Features
- Demonstrate typing indicators
- Show connection status and resilience
- Explain custom encryption algorithm
- Highlight security properties and limitations

## 🔍 Troubleshooting Common Issues

### Issue: "Connection Failed"
**Solutions**:
- Check backend server is running on port 5000
- Verify MongoDB is running
- Check CORS configuration
- Clear browser localStorage and retry

### Issue: "Messages Not Appearing"
**Solutions**:
- Check debug panel for encryption errors
- Verify both users are online
- Check browser console for JavaScript errors
- Restart both frontend and backend

### Issue: "Registration Failed"
**Solutions**:
- Check username uniqueness
- Verify password meets requirements
- Check backend database connection
- Review backend logs for errors

### Issue: "Debug Panel Not Working"
**Solutions**:
- Refresh browser page
- Check if debug mode is enabled
- Clear debug logs and retry
- Check browser console for errors

## 📊 Success Criteria

### ✅ All Tests Pass When:
- Users can register and login successfully
- Messages are encrypted and transmitted in real-time
- Debug panel shows encryption details
- Network traffic shows base64 encrypted payloads
- Room isolation works correctly
- Connection resilience handles server restarts
- Multiple browsers can chat simultaneously
- Typing indicators work in real-time
- Online/offline status updates correctly

### 🎯 Demo Success Metrics:
- **Setup Time**: < 5 minutes for full demo environment
- **Message Latency**: < 100ms for local testing
- **Encryption Visibility**: Debug panel shows all operations
- **Security Demo**: Network traffic shows no plaintext
- **User Experience**: Intuitive interface, no confusion

This comprehensive testing plan ensures the KrishnaCrypt application demonstrates both functional messaging and cybersecurity principles effectively.
