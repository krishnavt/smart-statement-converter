# Splitzee Real-Time Notification Architecture

## Problem
When Friend A updates an expense, how does Friend B's device receive the notification?

## Solution: Cloud-Based Sync Service

### Architecture Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Friend A      │    │  Cloud Service  │    │   Friend B      │
│   (Offline App) │    │                 │    │   (Offline App) │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ • Local Storage │    │ • REST API      │    │ • Local Storage │
│ • Sync Queue    │◄──►│ • WebSocket     │◄──►│ • Sync Queue    │
│ • Service Worker│    │ • Push Service  │    │ • Service Worker│
│ • Notifications │    │ • Database      │    │ • Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Flow: Friend A Updates Expense

1. **Local Update** (Friend A)
   - Updates expense in local storage
   - Adds to sync queue
   - Shows immediate UI feedback

2. **Background Sync** (Friend A → Cloud)
   - Service worker sends update to cloud
   - Cloud validates and stores update
   - Cloud identifies affected friends

3. **Real-time Notification** (Cloud → Friend B)
   - Cloud sends WebSocket message to Friend B
   - If Friend B offline: Cloud queues push notification
   - Cloud updates Friend B's sync queue

4. **Receive Update** (Friend B)
   - WebSocket receives real-time update OR
   - Push notification wakes app OR
   - Next sync check pulls updates

5. **Local Integration** (Friend B)
   - Updates local storage
   - Shows notification to user
   - Updates UI if app is open

## Implementation Options

### Option 1: Full Cloud Service
**Pros:**
- Reliable delivery
- Works across all devices
- Can handle complex group logic
- Push notifications when offline

**Cons:**
- Requires backend infrastructure
- Monthly hosting costs
- More complex deployment

**Tech Stack:**
- Backend: Node.js + Express + Socket.io
- Database: PostgreSQL + Redis
- Push: Firebase Cloud Messaging
- Hosting: Railway/Render/DigitalOcean

### Option 2: Serverless + Real-time
**Pros:**
- Lower costs (pay per use)
- Auto-scaling
- Less infrastructure management

**Cons:**
- Cold starts
- More complex WebSocket handling

**Tech Stack:**
- Functions: Vercel/Netlify Functions
- Database: Supabase/PlanetScale
- Real-time: Pusher/Ably
- Push: Web Push Protocol

### Option 3: Existing BaaS
**Pros:**
- Fastest to implement
- Built-in real-time features
- Authentication included

**Cons:**
- Vendor lock-in
- Higher costs at scale
- Less customization

**Options:**
- Supabase (PostgreSQL + real-time)
- Firebase (Firestore + Cloud Functions)
- AWS Amplify
- PocketBase (self-hosted)

## Sync Code System

### How Friends Connect Without Registration

1. **Generate Sync Code** (Friend A)
   ```javascript
   // Friend A generates code
   const syncCode = generateSyncCode(); // "AB12CD34"
   
   // Upload to cloud with user info
   await cloudService.createSyncCode({
     code: "AB12CD34",
     userId: "user_123",
     userName: "Alice",
     avatar: "👩",
     expires: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
   });
   ```

2. **Add Friend** (Friend B)
   ```javascript
   // Friend B enters code
   const friendData = await cloudService.addFriendByCode("AB12CD34");
   
   // Both users now linked in cloud
   await cloudService.linkFriends("user_123", "user_456");
   ```

3. **Sync Relationship**
   - Cloud creates bidirectional relationship
   - Both users can now see each other's updates
   - Sync codes expire after 24 hours for security

## Real-Time Update Flow

```javascript
// When Friend A updates expense
async function updateExpense(expenseId, updates) {
  // 1. Update locally first (instant UI)
  const updatedExpense = OfflineStorage.updateExpense(expenseId, updates);
  
  // 2. Add to sync queue
  OfflineStorage.addToSyncQueue('expense_update', {
    expenseId,
    updates,
    timestamp: Date.now(),
    userId: OfflineStorage.userId
  });
  
  // 3. If online, sync immediately
  if (navigator.onLine) {
    await syncToCloud();
  }
}

// Cloud service notifies all friends
async function notifyFriends(userId, update) {
  const friends = await db.getFriends(userId);
  
  for (const friend of friends) {
    // Real-time if online
    if (websocketConnections[friend.id]) {
      websocketConnections[friend.id].send({
        type: 'expense_update',
        data: update,
        from: userId
      });
    }
    
    // Push notification if offline
    else {
      await sendPushNotification(friend.pushToken, {
        title: 'Expense Updated',
        body: `${update.userName} updated an expense`,
        data: update
      });
    }
  }
}
```

## Cost Estimation

### Free Tier Limits
- **Vercel Functions:** 100GB-hours/month
- **Supabase:** 500MB DB, 5GB bandwidth
- **Firebase:** 20K writes, 50K reads/day
- **Pusher:** 200K messages/day

### Expected Usage (100 active users)
- **WebSocket connections:** ~50 concurrent
- **Database operations:** ~10K/day
- **Push notifications:** ~500/day
- **Storage:** ~100MB

**Result:** Most services' free tiers sufficient for initial launch

## Security Considerations

1. **Sync Code Security**
   - 8-character codes (62^8 = 218 trillion combinations)
   - 24-hour expiration
   - One-time use
   - Rate limiting on generation

2. **Data Privacy**
   - End-to-end encryption for expense data
   - Users only see shared expenses
   - No personal data stored without consent

3. **Authentication**
   - Anonymous user IDs
   - No email/password required
   - Device-based identity

## Implementation Priority

### Phase 1: MVP Backend
1. Simple REST API for sync codes
2. Basic WebSocket for real-time updates
3. SQLite database
4. Deploy on Railway/Render

### Phase 2: Production Features
1. Push notifications
2. Proper database (PostgreSQL)
3. Rate limiting and security
4. Error handling and retries

### Phase 3: Scale & Optimize
1. Redis caching
2. Background job processing
3. Analytics and monitoring
4. Advanced features

## Code Example: Simple Backend

```javascript
// server.js - Simple Node.js backend
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Simple in-memory storage for demo
const syncCodes = new Map();
const userSockets = new Map();

// Generate sync code endpoint
app.post('/api/sync-code', (req, res) => {
  const code = Math.random().toString(36).substr(2, 8).toUpperCase();
  const { userId, userName, avatar } = req.body;
  
  syncCodes.set(code, {
    userId,
    userName,
    avatar,
    created: Date.now(),
    expires: Date.now() + 24 * 60 * 60 * 1000
  });
  
  res.json({ code });
});

// Add friend by code endpoint
app.post('/api/add-friend', (req, res) => {
  const { code, requesterId } = req.body;
  const syncData = syncCodes.get(code);
  
  if (!syncData || syncData.expires < Date.now()) {
    return res.status(400).json({ error: 'Invalid or expired code' });
  }
  
  // Link friends (simplified)
  res.json({
    friend: {
      id: syncData.userId,
      name: syncData.userName,
      avatar: syncData.avatar
    }
  });
  
  // Notify both users they're now connected
  const requesterSocket = userSockets.get(requesterId);
  const friendSocket = userSockets.get(syncData.userId);
  
  if (requesterSocket) {
    requesterSocket.emit('friend_added', syncData);
  }
  if (friendSocket) {
    friendSocket.emit('friend_request', { requesterId });
  }
});

// WebSocket for real-time updates
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('register', (userId) => {
    userSockets.set(userId, socket);
    console.log('User registered:', userId);
  });
  
  socket.on('expense_update', (data) => {
    // Broadcast to all friends of this user
    // (In real implementation, get friends from database)
    socket.broadcast.emit('expense_update', data);
  });
  
  socket.on('disconnect', () => {
    // Remove from active users
    for (const [userId, userSocket] of userSockets.entries()) {
      if (userSocket === socket) {
        userSockets.delete(userId);
        break;
      }
    }
  });
});

server.listen(3001, () => {
  console.log('🚀 Sync service running on port 3001');
});
```

## Next Steps

1. **Choose Architecture:** Cloud service recommended for reliability
2. **Select Tech Stack:** Supabase + Vercel or Firebase for quick start
3. **Implement MVP Backend:** Basic sync codes + WebSocket notifications
4. **Update Frontend:** Replace demo notifications with real API calls
5. **Test with Multiple Devices:** Ensure real-time sync works
6. **Add Push Notifications:** For offline scenarios
7. **Deploy & Scale:** Monitor usage and optimize

The offline-first approach is great for UX, but you definitely need a cloud service for real friend-to-friend communication!