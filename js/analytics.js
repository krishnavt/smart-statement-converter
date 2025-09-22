// Advanced Analytics and Insights System
class Analytics {
    constructor() {
        this.metrics = {
            conversions: 0,
            totalPages: 0,
            totalTransactions: 0,
            banksDetected: {},
            fileSizes: [],
            processingTimes: [],
            errors: [],
            userEngagement: {
                pageViews: 0,
                timeSpent: 0,
                featuresUsed: {}
            }
        };
        
        this.sessionStart = Date.now();
        this.init();
    }

    init() {
        this.loadMetrics();
        this.setupTracking();
        this.startSessionTracking();
    }

    setupTracking() {
        // Track page views
        this.trackPageView();
        
        // Track user interactions
        this.trackUserInteractions();
        
        // Track file uploads
        this.trackFileUploads();
        
        // Track errors
        this.trackErrors();
    }

    trackPageView() {
        this.metrics.userEngagement.pageViews++;
        this.saveMetrics();
    }

    trackUserInteractions() {
        // Track button clicks
        document.addEventListener('click', (e) => {
            if (e.target.matches('button, .btn, .nav-link')) {
                this.trackEvent('button_click', {
                    element: e.target.textContent || e.target.className,
                    page: window.location.pathname
                });
            }
        });
        
        // Track form submissions
        document.addEventListener('submit', (e) => {
            this.trackEvent('form_submit', {
                form: e.target.id || e.target.className,
                page: window.location.pathname
            });
        });
    }

    trackFileUploads() {
        const fileInput = document.getElementById('fileInput');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const files = Array.from(e.target.files);
                files.forEach(file => {
                    this.trackEvent('file_upload', {
                        fileName: file.name,
                        fileSize: file.size,
                        fileType: file.type,
                        timestamp: Date.now()
                    });
                });
            });
        }
    }

    trackErrors() {
        window.addEventListener('error', (e) => {
            this.trackEvent('javascript_error', {
                message: e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                timestamp: Date.now()
            });
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            this.trackEvent('promise_rejection', {
                reason: e.reason,
                timestamp: Date.now()
            });
        });
    }

    startSessionTracking() {
        // Track time spent on page
        setInterval(() => {
            this.metrics.userEngagement.timeSpent += 1000; // 1 second
            this.saveMetrics();
        }, 1000);
        
        // Track page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.trackEvent('page_hidden', { timestamp: Date.now() });
            } else {
                this.trackEvent('page_visible', { timestamp: Date.now() });
            }
        });
    }

    // Conversion tracking
    trackConversion(conversionData) {
        this.metrics.conversions++;
        this.metrics.totalPages += conversionData.pages || 0;
        this.metrics.totalTransactions += conversionData.transactions || 0;
        
        if (conversionData.bank) {
            this.metrics.banksDetected[conversionData.bank] = 
                (this.metrics.banksDetected[conversionData.bank] || 0) + 1;
        }
        
        if (conversionData.fileSize) {
            this.metrics.fileSizes.push(conversionData.fileSize);
        }
        
        if (conversionData.processingTime) {
            this.metrics.processingTimes.push(conversionData.processingTime);
        }
        
        this.trackEvent('conversion_completed', conversionData);
        this.saveMetrics();
    }

    // Error tracking
    trackError(errorData) {
        this.metrics.errors.push({
            ...errorData,
            timestamp: Date.now()
        });
        
        this.trackEvent('error_occurred', errorData);
        this.saveMetrics();
    }

    // Feature usage tracking
    trackFeatureUsage(feature, details = {}) {
        this.metrics.userEngagement.featuresUsed[feature] = 
            (this.metrics.userEngagement.featuresUsed[feature] || 0) + 1;
        
        this.trackEvent('feature_used', {
            feature,
            ...details,
            timestamp: Date.now()
        });
        
        this.saveMetrics();
    }

    // Generic event tracking
    trackEvent(eventName, data = {}) {
        const event = {
            name: eventName,
            data: data,
            timestamp: Date.now(),
            sessionId: this.getSessionId(),
            userId: this.getUserId()
        };
        
        // Store in localStorage for debugging
        this.storeEvent(event);
        
        // Send to server in production
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            this.sendEventToServer(event);
        }
    }

    // Analytics dashboard data
    getDashboardData() {
        const sessionDuration = Date.now() - this.sessionStart;
        const avgProcessingTime = this.calculateAverage(this.metrics.processingTimes);
        const avgFileSize = this.calculateAverage(this.metrics.fileSizes);
        
        return {
            overview: {
                totalConversions: this.metrics.conversions,
                totalPages: this.metrics.totalPages,
                totalTransactions: this.metrics.totalTransactions,
                sessionDuration: this.formatDuration(sessionDuration),
                pageViews: this.metrics.userEngagement.pageViews
            },
            performance: {
                avgProcessingTime: this.formatDuration(avgProcessingTime),
                avgFileSize: this.formatFileSize(avgFileSize),
                successRate: this.calculateSuccessRate()
            },
            banks: this.metrics.banksDetected,
            features: this.metrics.userEngagement.featuresUsed,
            recentErrors: this.metrics.errors.slice(-5),
            charts: {
                conversionsOverTime: this.getConversionsOverTime(),
                bankDistribution: this.getBankDistribution(),
                fileSizeDistribution: this.getFileSizeDistribution()
            }
        };
    }

    // Utility methods
    calculateAverage(numbers) {
        if (numbers.length === 0) return 0;
        return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
    }

    calculateSuccessRate() {
        const totalAttempts = this.metrics.conversions + this.metrics.errors.length;
        if (totalAttempts === 0) return 100;
        return Math.round((this.metrics.conversions / totalAttempts) * 100);
    }

    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        return `${Math.round(ms / 60000)}m`;
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${Math.round(bytes / (1024 * 1024))} MB`;
    }

    getConversionsOverTime() {
        // Return mock data for now - in real implementation, this would come from server
        const now = Date.now();
        return Array.from({ length: 7 }, (_, i) => ({
            date: new Date(now - (6 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            conversions: Math.floor(Math.random() * 10) + 1
        }));
    }

    getBankDistribution() {
        return Object.entries(this.metrics.banksDetected).map(([bank, count]) => ({
            bank,
            count,
            percentage: Math.round((count / this.metrics.conversions) * 100)
        }));
    }

    getFileSizeDistribution() {
        const ranges = [
            { min: 0, max: 100000, label: '< 100KB' },
            { min: 100000, max: 500000, label: '100KB - 500KB' },
            { min: 500000, max: 1000000, label: '500KB - 1MB' },
            { min: 1000000, max: 5000000, label: '1MB - 5MB' },
            { min: 5000000, max: Infinity, label: '> 5MB' }
        ];
        
        return ranges.map(range => ({
            range: range.label,
            count: this.metrics.fileSizes.filter(size => size >= range.min && size < range.max).length
        }));
    }

    // Storage methods
    saveMetrics() {
        try {
            localStorage.setItem('analytics_metrics', JSON.stringify(this.metrics));
        } catch (e) {
            console.error('Failed to save analytics metrics:', e);
        }
    }

    loadMetrics() {
        try {
            const saved = localStorage.getItem('analytics_metrics');
            if (saved) {
                this.metrics = { ...this.metrics, ...JSON.parse(saved) };
            }
        } catch (e) {
            console.error('Failed to load analytics metrics:', e);
        }
    }

    storeEvent(event) {
        try {
            const events = JSON.parse(localStorage.getItem('analytics_events') || '[]');
            events.push(event);
            
            // Keep only last 100 events
            if (events.length > 100) {
                events.splice(0, events.length - 100);
            }
            
            localStorage.setItem('analytics_events', JSON.stringify(events));
        } catch (e) {
            console.error('Failed to store analytics event:', e);
        }
    }

    async sendEventToServer(event) {
        try {
            await fetch('/api/analytics', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(event)
            });
        } catch (e) {
            console.error('Failed to send analytics event to server:', e);
        }
    }

    getSessionId() {
        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('analytics_session_id', sessionId);
        }
        return sessionId;
    }

    getUserId() {
        // Get user ID from current user or generate anonymous ID
        if (window.app && window.app.currentUser) {
            return window.app.currentUser.id;
        }
        
        let userId = localStorage.getItem('analytics_user_id');
        if (!userId) {
            userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('analytics_user_id', userId);
        }
        return userId;
    }

    // Export data
    exportData() {
        const data = {
            metrics: this.metrics,
            dashboard: this.getDashboardData(),
            events: JSON.parse(localStorage.getItem('analytics_events') || '[]'),
            exportedAt: new Date().toISOString()
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }

    // Clear data
    clearData() {
        this.metrics = {
            conversions: 0,
            totalPages: 0,
            totalTransactions: 0,
            banksDetected: {},
            fileSizes: [],
            processingTimes: [],
            errors: [],
            userEngagement: {
                pageViews: 0,
                timeSpent: 0,
                featuresUsed: {}
            }
        };
        
        localStorage.removeItem('analytics_metrics');
        localStorage.removeItem('analytics_events');
        sessionStorage.removeItem('analytics_session_id');
        
        this.saveMetrics();
    }
}

// Export for use in other scripts
window.Analytics = Analytics;