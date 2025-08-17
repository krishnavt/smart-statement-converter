// Simple sync server for cross-device friend codes
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// File to store sync codes
const syncCodesFile = path.join(__dirname, 'sync-codes.json');
const notificationsFile = path.join(__dirname, 'sync-notifications.json');

// Initialize files if they don't exist
if (!fs.existsSync(syncCodesFile)) {
    fs.writeFileSync(syncCodesFile, JSON.stringify([]));
}
if (!fs.existsSync(notificationsFile)) {
    fs.writeFileSync(notificationsFile, JSON.stringify([]));
}

// Helper functions
function readSyncCodes() {
    try {
        return JSON.parse(fs.readFileSync(syncCodesFile, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeSyncCodes(codes) {
    fs.writeFileSync(syncCodesFile, JSON.stringify(codes, null, 2));
}

function readNotifications() {
    try {
        return JSON.parse(fs.readFileSync(notificationsFile, 'utf8'));
    } catch (error) {
        return [];
    }
}

function writeNotifications(notifications) {
    fs.writeFileSync(notificationsFile, JSON.stringify(notifications, null, 2));
}

// Clean expired codes
function cleanExpiredCodes() {
    const codes = readSyncCodes();
    const now = Date.now();
    const validCodes = codes.filter(code => code.expires > now);
    writeSyncCodes(validCodes);
    return validCodes;
}

// Routes

// Store a sync code
app.post('/api/sync-codes', (req, res) => {
    const { code, userId, userName, userAvatar, expires } = req.body;
    
    if (!code || !userId || !userName) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const codes = cleanExpiredCodes();
    
    // Check if code already exists
    const existingCode = codes.find(c => c.code === code);
    if (existingCode) {
        return res.status(409).json({ error: 'Code already exists' });
    }
    
    const newCode = {
        code,
        userId,
        userName,
        userAvatar,
        created: Date.now(),
        expires: expires || (Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };
    
    codes.push(newCode);
    writeSyncCodes(codes);
    
    console.log(`📝 Stored sync code: ${code} for ${userName}`);
    res.json({ success: true, code: newCode });
});

// Get a sync code and establish bidirectional friendship
app.post('/api/sync-codes/:code/add-friend', (req, res) => {
    const { code } = req.params;
    const { userId, userName, userAvatar } = req.body;
    
    if (!userId || !userName) {
        return res.status(400).json({ error: 'Missing user information' });
    }
    
    const codes = cleanExpiredCodes();
    const foundCode = codes.find(c => c.code === code.toUpperCase());
    
    if (!foundCode) {
        return res.status(404).json({ error: 'Code not found or expired' });
    }
    
    // Don't let users add themselves
    if (foundCode.userId === userId) {
        return res.status(400).json({ error: 'Cannot add yourself as a friend' });
    }
    
    const notifications = readNotifications();
    
    // Create notification for the code owner (foundCode.userId gets notification that userId added them)
    const friendNotification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        userId: foundCode.userId,
        title: 'New Friend Added',
        message: `${userName} added you as a friend`,
        type: 'friend_added',
        icon: '👥',
        fromUser: userId,
        fromUserName: userName,
        timestamp: Date.now(),
        processed: false
    };
    
    // Create reciprocal notification for the friend adder (userId gets notification that they added foundCode.userId)
    const reciprocalNotification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        userId: userId,
        title: 'Friend Added Successfully',
        message: `You are now friends with ${foundCode.userName}`,
        type: 'friend_confirmed',
        icon: '✅',
        fromUser: foundCode.userId,
        fromUserName: foundCode.userName,
        friendData: {
            id: foundCode.userId,
            name: foundCode.userName,
            avatar: foundCode.userAvatar || '👤'
        },
        timestamp: Date.now(),
        processed: false
    };
    
    // Also create reciprocal friend notification for the friend adder
    const bidirectionalNotification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        userId: userId,
        title: 'New Friend Added',
        message: `${foundCode.userName} is now your friend`,
        type: 'friend_added',
        icon: '👥',
        fromUser: foundCode.userId,
        fromUserName: foundCode.userName,
        timestamp: Date.now(),
        processed: false
    };
    
    notifications.push(friendNotification, reciprocalNotification, bidirectionalNotification);
    writeNotifications(notifications);
    
    console.log(`🤝 Bidirectional friendship established between ${userName} and ${foundCode.userName}`);
    console.log(`🔔 Created notifications for both users`);
    
    res.json({ 
        success: true, 
        friend: {
            id: foundCode.userId,
            name: foundCode.userName,
            avatar: foundCode.userAvatar || '👤'
        },
        bidirectional: true
    });
});

// Legacy endpoint for backward compatibility
app.get('/api/sync-codes/:code', (req, res) => {
    const { code } = req.params;
    const codes = cleanExpiredCodes();
    
    const foundCode = codes.find(c => c.code === code.toUpperCase());
    
    if (!foundCode) {
        return res.status(404).json({ error: 'Code not found or expired' });
    }
    
    console.log(`🔍 Retrieved sync code: ${code} for ${foundCode.userName}`);
    res.json(foundCode);
});

// Store a notification
app.post('/api/notifications', (req, res) => {
    const notification = req.body;
    
    if (!notification.userId || !notification.title) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const notifications = readNotifications();
    
    const newNotification = {
        id: 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        ...notification,
        timestamp: Date.now(),
        processed: false
    };
    
    notifications.push(newNotification);
    writeNotifications(notifications);
    
    console.log(`🔔 Stored notification for ${notification.userId}: ${notification.title}`);
    res.json({ success: true, notification: newNotification });
});

// Get notifications for a user
app.get('/api/notifications/:userId', (req, res) => {
    const { userId } = req.params;
    const notifications = readNotifications();
    
    const userNotifications = notifications.filter(n => 
        n.userId === userId && !n.processed
    );
    
    // Mark as processed
    notifications.forEach(n => {
        if (n.userId === userId && !n.processed) {
            n.processed = true;
        }
    });
    writeNotifications(notifications);
    
    console.log(`📬 Retrieved ${userNotifications.length} notifications for ${userId}`);
    res.json(userNotifications);
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: Date.now(),
        codes: readSyncCodes().length,
        notifications: readNotifications().length
    });
});

// Clear all test data (for testing purposes)
app.delete('/api/clear-test-data', (req, res) => {
    try {
        // Clear sync codes
        writeSyncCodes([]);
        
        // Clear notifications  
        writeNotifications([]);
        
        console.log('🧹 Cleared all test data (codes and notifications)');
        res.json({ 
            success: true, 
            message: 'All test data cleared',
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('❌ Error clearing test data:', error);
        res.status(500).json({ 
            error: 'Failed to clear test data',
            details: error.message 
        });
    }
});

// Clean up old data periodically
setInterval(() => {
    cleanExpiredCodes();
    // Clean old notifications (older than 7 days)
    const notifications = readNotifications();
    const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentNotifications = notifications.filter(n => n.timestamp > weekAgo);
    if (recentNotifications.length !== notifications.length) {
        writeNotifications(recentNotifications);
        console.log('🧹 Cleaned old notifications');
    }
}, 60000); // Every minute

app.listen(port, '0.0.0.0', () => {
    console.log(`🚀 Sync server running on http://0.0.0.0:${port}`);
    console.log(`📱 Access from other devices: http://192.168.6.163:${port}`);
    console.log(`🔗 Health check: http://localhost:${port}/api/health`);
});