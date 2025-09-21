// Enhanced Error Handling System
class ErrorHandler {
    constructor(uiUtils) {
        this.uiUtils = uiUtils;
        this.errorTypes = {
            NETWORK_ERROR: 'network',
            VALIDATION_ERROR: 'validation',
            PROCESSING_ERROR: 'processing',
            AUTH_ERROR: 'auth',
            FILE_ERROR: 'file',
            SYSTEM_ERROR: 'system'
        };
        
        this.errorMessages = {
            network: {
                title: 'Connection Error',
                message: 'Unable to connect to the server. Please check your internet connection.',
                action: 'Retry'
            },
            validation: {
                title: 'Invalid Input',
                message: 'Please check your input and try again.',
                action: 'Fix Input'
            },
            processing: {
                title: 'Processing Error',
                message: 'There was an error processing your file. Please try again.',
                action: 'Retry'
            },
            auth: {
                title: 'Authentication Error',
                message: 'Please log in again to continue.',
                action: 'Login'
            },
            file: {
                title: 'File Error',
                message: 'There was an error with your file. Please check the format.',
                action: 'Upload New File'
            },
            system: {
                title: 'System Error',
                message: 'An unexpected error occurred. Please try again later.',
                action: 'Contact Support'
            }
        };
    }

    handleError(error, context = {}) {
        console.error('Error occurred:', error, context);
        
        const errorType = this.classifyError(error);
        const errorInfo = this.errorMessages[errorType];
        
        // Show user-friendly error message
        this.showErrorToast(errorInfo, error, context);
        
        // Log error for debugging
        this.logError(error, context, errorType);
        
        // Return error info for programmatic handling
        return {
            type: errorType,
            message: errorInfo.message,
            originalError: error,
            context: context
        };
    }

    classifyError(error) {
        if (error.name === 'NetworkError' || error.message.includes('fetch')) {
            return this.errorTypes.NETWORK_ERROR;
        }
        
        if (error.message.includes('validation') || error.message.includes('invalid')) {
            return this.errorTypes.VALIDATION_ERROR;
        }
        
        if (error.message.includes('processing') || error.message.includes('conversion')) {
            return this.errorTypes.PROCESSING_ERROR;
        }
        
        if (error.message.includes('auth') || error.message.includes('login')) {
            return this.errorTypes.AUTH_ERROR;
        }
        
        if (error.message.includes('file') || error.message.includes('upload')) {
            return this.errorTypes.FILE_ERROR;
        }
        
        return this.errorTypes.SYSTEM_ERROR;
    }

    showErrorToast(errorInfo, originalError, context) {
        const message = this.buildErrorMessage(errorInfo, originalError, context);
        
        // Show error toast with action button
        const toast = this.uiUtils.showToast(message, 'error', 8000);
        
        // Add action button if available
        if (errorInfo.action && toast) {
            this.addActionButton(toast, errorInfo.action, context);
        }
    }

    buildErrorMessage(errorInfo, originalError, context) {
        let message = errorInfo.message;
        
        // Add specific details if available
        if (context.fileName) {
            message += ` (File: ${context.fileName})`;
        }
        
        if (context.userId) {
            message += ` (User: ${context.userId.substring(0, 8)}...)`;
        }
        
        // Add technical details in development
        if (process.env.NODE_ENV === 'development') {
            message += `\n\nTechnical: ${originalError.message}`;
        }
        
        return message;
    }

    addActionButton(toast, actionText, context) {
        if (!toast) return;
        
        const button = document.createElement('button');
        button.textContent = actionText;
        button.className = 'toast-action-btn';
        button.style.cssText = `
            margin-left: 10px;
            padding: 4px 8px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 12px;
        `;
        
        button.addEventListener('click', () => {
            this.handleAction(actionText, context);
            this.uiUtils.removeToast(toast);
        });
        
        const content = toast.querySelector('div');
        if (content) {
            content.appendChild(button);
        }
    }

    handleAction(actionText, context) {
        switch (actionText) {
            case 'Retry':
                if (context.retryFunction) {
                    context.retryFunction();
                } else {
                    window.location.reload();
                }
                break;
                
            case 'Login':
                window.location.href = '/api/login';
                break;
                
            case 'Upload New File':
                const fileInput = document.getElementById('fileInput');
                if (fileInput) fileInput.click();
                break;
                
            case 'Contact Support':
                window.open('mailto:support@smartstatementconverter.com', '_blank');
                break;
                
            case 'Fix Input':
                // Focus on the problematic input field
                if (context.inputField) {
                    context.inputField.focus();
                }
                break;
        }
    }

    logError(error, context, errorType) {
        const errorLog = {
            timestamp: new Date().toISOString(),
            type: errorType,
            message: error.message,
            stack: error.stack,
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        // Store in localStorage for debugging
        try {
            const logs = JSON.parse(localStorage.getItem('errorLogs') || '[]');
            logs.push(errorLog);
            
            // Keep only last 50 errors
            if (logs.length > 50) {
                logs.splice(0, logs.length - 50);
            }
            
            localStorage.setItem('errorLogs', JSON.stringify(logs));
        } catch (e) {
            console.error('Failed to log error:', e);
        }
        
        // Send to server in production
        if (process.env.NODE_ENV === 'production') {
            this.sendErrorToServer(errorLog);
        }
    }

    async sendErrorToServer(errorLog) {
        try {
            await fetch('/api/errors', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(errorLog)
            });
        } catch (e) {
            console.error('Failed to send error to server:', e);
        }
    }

    // Utility method to wrap async functions with error handling
    async withErrorHandling(asyncFunction, context = {}) {
        try {
            return await asyncFunction();
        } catch (error) {
            return this.handleError(error, context);
        }
    }

    // Get error logs for debugging
    getErrorLogs() {
        try {
            return JSON.parse(localStorage.getItem('errorLogs') || '[]');
        } catch (e) {
            return [];
        }
    }

    // Clear error logs
    clearErrorLogs() {
        localStorage.removeItem('errorLogs');
    }
}

// Export for use in other scripts
window.ErrorHandler = ErrorHandler;