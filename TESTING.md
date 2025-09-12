# KrishnaCrypt Manual Testing Plan

## 🧪 Comprehensive Testing Guide for Encrypted Friend-Based Messaging Demo

### Prerequisites
- MongoDB### Test 3.1: Basic Friend Messaging
**Objective**: Verify encrypted messaging between friends

**Steps**:
1. **Alice's browser**: Click on "bob" in friends list
2. ✅ Should show "Secure tunnel established" message
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

### Test 3.2: Non-Friend Messaging Prevention
**Objective**: Verify that messaging is restricted to friends only

**Steps**:
1. **Create new user**: Register as `diana` in new browser
2. **Diana tries to message Alice**: Enter Alice's secret ID
3. ✅ Diana should NOT be able to see Alice in any list
4. **Diana tries to join room**: Should be rejected by server
5. **Alice's friends list**: Should NOT show Diana
6. **Verify isolation**: Only Bob and Charlie can message Alice

**Expected Results**:
- Non-friends cannot initiate conversations
- Server rejects unauthorized room joins
- Friend relationships enforce messaging restrictions
- Privacy is maintained between non-friendsr Atlas)
- Backend server running on port 5432
- Frontend running on port 3000
- Two different browsers or incognito windows

## Test Suite 1: Authentication & Friend Setup (20 minutes)

### Test 1.1: User Registration with Secret ID
**Objective**: Verify user registration with secret ID generation

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
6. ✅ Should display unique secret ID (UUID format)
7. Should automatically switch to login form

**Expected Results**:
- Form validation works correctly
- Successful registration message appears
- Unique secret ID is generated and displayed
- User can proceed to login

### Test 1.2: User Login
**Objective**: Verify JWT authentication flow

**Steps**:
1. Login with registered credentials
2. ✅ Should redirect to chat interface
3. Should see "Welcome, alice" in header
4. Should see connection status: "🟢 Connected"
5. Check browser localStorage for `authToken`
6. ✅ Should see user's secret ID displayed
7. ✅ Should see empty friends list initially

**Expected Results**:
- JWT token stored in localStorage
- Socket connection established
- User interface loads correctly
- Secret ID is visible for copying
- Friends list is initially empty

### Test 1.3: Secret ID Copy Functionality
**Objective**: Test secret ID copying for friend sharing

**Steps**:
1. **Alice's browser**: Click "Copy Secret ID" button
2. ✅ Should show "Secret ID copied!" notification
3. **Verify clipboard**: Paste in notepad/text editor
4. ✅ Should contain the full UUID (e.g., `f47ac10b-58cc-4372-a567-0e02b2c3d479`)

**Expected Results**:
- Copy functionality works correctly
- User feedback is provided
- Secret ID is properly copied to clipboard

### Test 1.4: Multiple User Setup
**Objective**: Create test users for friend-based messaging

**Steps**:
1. **Browser 1**: Register/login as `alice`
2. **Browser 2** (incognito): Register/login as `bob`
3. **Browser 3** (different browser): Register/login as `charlie`
4. **Note each user's secret ID** for friend addition testing

**Expected Results**:
- All users can register and login independently
- Each user gets a unique secret ID
- Friends lists are initially empty
- No users appear in friends list until added

## Test Suite 2: Friend Management (15 minutes)

### Test 2.1: Add Friend by Secret ID
**Objective**: Verify friend addition functionality

**Steps**:
1. **Alice's browser**: Enter Bob's secret ID in "Add Friend" input
2. Click "Add Friend" button
3. ✅ Should show "Friend added successfully!" message
4. ✅ Bob should appear in Alice's friends list
5. **Bob's browser**: Should see Alice in friends list
6. **Verify mutual friendship**: Both users should see each other

**Expected Results**:
- Friend addition works with valid secret ID
- Success message is displayed
- Friends list updates in real-time
- Friendship is bidirectional

### Test 2.2: Invalid Secret ID Handling
**Objective**: Test error handling for invalid secret IDs

**Steps**:
1. **Alice's browser**: Enter invalid secret ID (e.g., `invalid-id`)
2. Click "Add Friend" button
3. ✅ Should show error message: "Invalid secret ID or user not found"
4. **Try Charlie's secret ID** (not yet friends)
5. ✅ Should add successfully
6. **Try Alice's own secret ID**
7. ✅ Should show error: "Cannot add yourself as a friend"

**Expected Results**:
- Invalid secret IDs are rejected
- Clear error messages are provided
- Self-addition is prevented
- Valid secret IDs work correctly

### Test 2.3: Friend List Display
**Objective**: Verify friends list shows correct information

**Steps**:
1. **Alice's browser**: Check friends list
2. ✅ Should show Bob and Charlie as friends
3. ✅ Should show online/offline status
4. ✅ Should NOT show Alice herself in the list
5. **Close Bob's browser**
6. **Alice's browser**: Should see Bob go offline
7. **Reopen Bob's browser and login**
8. **Alice's browser**: Should see Bob come back online

**Expected Results**:
- Friends list displays correctly
- Online status updates in real-time
- Current user is not shown in their own friends list
- Friend relationships are properly maintained

## Test Suite 3: Friend-Based Encrypted Messaging (20 minutes)

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

### Test 3.4: Multiple Friend Conversations
**Objective**: Test messaging isolation between different friend pairs

**Steps**:
1. **Alice ↔ Bob conversation**:
   - Alice sends: "Secret message for Bob only"
   - Verify Bob receives it
2. **Alice ↔ Charlie conversation**:
   - Alice clicks on "charlie" in friends list
   - ✅ Should create NEW room with different Room ID
   - Alice sends: "Different secret for Charlie"
   - Verify Charlie receives it, Bob does NOT
3. **Bob ↔ Charlie conversation**:
   - Bob clicks on "charlie"
   - ✅ Should create THIRD unique room
   - Bob sends: "Bob to Charlie direct"
   - Verify Charlie receives it, Alice does NOT

**Expected Results**:
- Each friend pair has unique Room ID (SHA-256 hash)
- Messages are isolated between different conversations
- No cross-talk between different encrypted tunnels
- Friend relationships maintain conversation privacy

## Test Suite 3: Real-Time Features (10 minutes)

### Test 4.1: Typing Indicators
**Objective**: Test real-time typing notifications between friends

**Steps**:
1. **Alice's browser**: Start typing in message input (with Bob selected)
2. **Bob's browser**: Should see "alice is typing..." indicator
3. **Alice**: Stop typing for 1 second
4. **Bob**: Typing indicator should disappear
5. **Bob**: Start typing
6. **Alice**: Should see "bob is typing..." indicator

**Expected Results**:
- Typing indicators appear/disappear correctly
- No delay or lag in real-time updates
- Only works between friends

### Test 4.2: Friend Presence
**Objective**: Verify online/offline status tracking for friends

**Steps**:
1. **All browsers**: Verify green online indicators next to friends
2. **Close Bob's browser**
3. **Alice & Charlie**: Should see Bob go offline in friends list
4. **Reopen Bob's browser and login**
5. **Alice & Charlie**: Should see Bob come back online
6. **Diana (non-friend)**: Should NOT see any online status updates

**Expected Results**:
- Online status updates in real-time for friends
- Non-friends don't see presence information
- Friend relationships control visibility

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

### Test 5.3: Friend-Based Access Control Demo
**Objective**: Demonstrate privacy through friend relationships

**Steps**:
1. **Show Alice's friends list**: Only Bob and Charlie
2. **Show Diana's friends list**: Empty or different friends
3. **Attempt cross-messaging**: Diana cannot message Alice
4. **Explain**: Secret IDs enable controlled friend discovery
5. **Demonstrate**: Only mutual friends can communicate

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

### Issue: "Friend Addition Failed"
**Solutions**:
- Verify secret ID format (UUID v4)
- Check if user exists
- Ensure not adding yourself
- Check network connectivity

### Issue: "Messages Not Appearing"
**Solutions**:
- Check debug panel for encryption errors
- Verify both users are online friends
- Check browser console for JavaScript errors
- Restart both frontend and backend

### Issue: "Registration Failed"
**Solutions**:
- Check username uniqueness
- Verify password meets requirements
- Check backend database connection
- Review backend logs for errors

### Issue: "Cannot Message Non-Friend"
**Solutions**:
- This is expected behavior for privacy
- Add user as friend first using secret ID
- Verify friend relationship is mutual
- Check online status of friend

## 📊 Success Criteria

### ✅ All Tests Pass When:
- Users can register with unique secret IDs
- Secret ID copying and sharing works
- Friend addition by secret ID functions correctly
- Only friends can message each other when online
- Messages are encrypted and transmitted in real-time
- Debug panel shows encryption details
- Network traffic shows base64 encrypted payloads
- Friend relationships enforce messaging restrictions
- Room isolation works correctly between friend pairs
- Connection resilience handles server restarts
- Multiple browsers can chat simultaneously
- Typing indicators work between friends
- Online/offline status updates correctly for friends

### 🎯 Demo Success Metrics:
- **Setup Time**: < 5 minutes for full demo environment
- **Friend Addition**: < 30 seconds per friend
- **Message Latency**: < 100ms for local testing
- **Encryption Visibility**: Debug panel shows all operations
- **Security Demo**: Network traffic shows no plaintext
- **Privacy Demo**: Non-friends cannot communicate
- **User Experience**: Intuitive friend management interface

This comprehensive testing plan ensures the KrishnaCrypt application demonstrates both functional messaging and cybersecurity principles effectively.
