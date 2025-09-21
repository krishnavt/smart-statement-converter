// Real-time Progress Tracking System
class ProgressTracker {
    constructor(uiUtils) {
        this.uiUtils = uiUtils;
        this.activeTasks = new Map();
        this.progressContainer = null;
        this.init();
    }

    init() {
        this.createProgressContainer();
        this.setupEventListeners();
    }

    createProgressContainer() {
        this.progressContainer = document.createElement('div');
        this.progressContainer.id = 'progress-tracker';
        this.progressContainer.className = 'progress-tracker';
        this.progressContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 1001;
            max-width: 400px;
            display: flex;
            flex-direction: column;
            gap: 10px;
        `;
        
        document.body.appendChild(this.progressContainer);
    }

    setupEventListeners() {
        // Listen for custom progress events
        window.addEventListener('progress-start', (e) => {
            this.startTask(e.detail);
        });
        
        window.addEventListener('progress-update', (e) => {
            this.updateTask(e.detail);
        });
        
        window.addEventListener('progress-complete', (e) => {
            this.completeTask(e.detail);
        });
        
        window.addEventListener('progress-error', (e) => {
            this.errorTask(e.detail);
        });
    }

    startTask(taskInfo) {
        const taskId = taskInfo.id || this.generateTaskId();
        const task = {
            id: taskId,
            title: taskInfo.title || 'Processing...',
            description: taskInfo.description || '',
            progress: 0,
            status: 'running',
            startTime: Date.now(),
            steps: taskInfo.steps || [],
            currentStep: 0
        };
        
        this.activeTasks.set(taskId, task);
        this.renderTask(task);
        
        return taskId;
    }

    updateTask(updateInfo) {
        const taskId = updateInfo.id;
        const task = this.activeTasks.get(taskId);
        
        if (!task) return;
        
        // Update task properties
        if (updateInfo.progress !== undefined) {
            task.progress = Math.min(100, Math.max(0, updateInfo.progress));
        }
        
        if (updateInfo.description) {
            task.description = updateInfo.description;
        }
        
        if (updateInfo.currentStep !== undefined) {
            task.currentStep = updateInfo.currentStep;
        }
        
        if (updateInfo.steps) {
            task.steps = updateInfo.steps;
        }
        
        this.renderTask(task);
    }

    completeTask(taskInfo) {
        const taskId = taskInfo.id;
        const task = this.activeTasks.get(taskId);
        
        if (!task) return;
        
        task.status = 'completed';
        task.progress = 100;
        task.endTime = Date.now();
        task.duration = task.endTime - task.startTime;
        
        this.renderTask(task);
        
        // Auto-remove after delay
        setTimeout(() => {
            this.removeTask(taskId);
        }, 3000);
    }

    errorTask(taskInfo) {
        const taskId = taskInfo.id;
        const task = this.activeTasks.get(taskId);
        
        if (!task) return;
        
        task.status = 'error';
        task.error = taskInfo.error;
        task.endTime = Date.now();
        task.duration = task.endTime - task.startTime;
        
        this.renderTask(task);
        
        // Auto-remove after delay
        setTimeout(() => {
            this.removeTask(taskId);
        }, 5000);
    }

    renderTask(task) {
        let taskElement = document.getElementById(`task-${task.id}`);
        
        if (!taskElement) {
            taskElement = document.createElement('div');
            taskElement.id = `task-${task.id}`;
            taskElement.className = 'progress-task';
            taskElement.style.cssText = `
                background: white;
                border-radius: 8px;
                padding: 16px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                border-left: 4px solid #4F46E5;
                transition: all 0.3s ease;
            `;
            
            this.progressContainer.appendChild(taskElement);
        }
        
        // Update task content
        taskElement.innerHTML = this.buildTaskHTML(task);
        
        // Update styling based on status
        this.updateTaskStyling(taskElement, task);
    }

    buildTaskHTML(task) {
        const statusIcon = this.getStatusIcon(task.status);
        const progressBar = this.buildProgressBar(task);
        const steps = this.buildSteps(task);
        const duration = task.duration ? this.formatDuration(task.duration) : '';
        
        return `
            <div class="task-header">
                <div class="task-title">
                    <span class="status-icon">${statusIcon}</span>
                    <span class="title-text">${task.title}</span>
                </div>
                <div class="task-meta">
                    <span class="progress-text">${task.progress}%</span>
                    ${duration ? `<span class="duration">${duration}</span>` : ''}
                </div>
            </div>
            
            ${task.description ? `<div class="task-description">${task.description}</div>` : ''}
            
            ${progressBar}
            
            ${steps}
            
            ${task.error ? `<div class="task-error">Error: ${task.error}</div>` : ''}
        `;
    }

    buildProgressBar(task) {
        return `
            <div class="progress-bar-container">
                <div class="progress-bar" style="width: ${task.progress}%"></div>
            </div>
        `;
    }

    buildSteps(task) {
        if (!task.steps || task.steps.length === 0) return '';
        
        return `
            <div class="task-steps">
                ${task.steps.map((step, index) => `
                    <div class="step ${index < task.currentStep ? 'completed' : index === task.currentStep ? 'current' : 'pending'}">
                        <span class="step-icon">${this.getStepIcon(index, task.currentStep)}</span>
                        <span class="step-text">${step}</span>
                    </div>
                `).join('')}
            </div>
        `;
    }

    getStatusIcon(status) {
        const icons = {
            running: '⏳',
            completed: '✅',
            error: '❌',
            paused: '⏸️'
        };
        return icons[status] || '⏳';
    }

    getStepIcon(index, currentStep) {
        if (index < currentStep) return '✅';
        if (index === currentStep) return '⏳';
        return '⏸️';
    }

    updateTaskStyling(element, task) {
        const borderColors = {
            running: '#4F46E5',
            completed: '#10B981',
            error: '#EF4444',
            paused: '#F59E0B'
        };
        
        element.style.borderLeftColor = borderColors[task.status] || '#4F46E5';
        
        if (task.status === 'completed') {
            element.style.opacity = '0.8';
        }
    }

    removeTask(taskId) {
        const taskElement = document.getElementById(`task-${taskId}`);
        if (taskElement) {
            taskElement.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => {
                if (taskElement.parentNode) {
                    taskElement.parentNode.removeChild(taskElement);
                }
            }, 300);
        }
        
        this.activeTasks.delete(taskId);
    }

    generateTaskId() {
        return 'task-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        if (seconds < 60) return `${seconds}s`;
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }

    // Utility methods for common tasks
    startFileUpload(fileName) {
        return this.startTask({
            title: 'Uploading File',
            description: `Uploading ${fileName}...`,
            steps: ['Validating file', 'Uploading to server', 'Processing']
        });
    }

    startPDFProcessing(fileName) {
        return this.startTask({
            title: 'Processing PDF',
            description: `Converting ${fileName} to CSV...`,
            steps: ['Extracting text', 'Parsing transactions', 'Generating CSV', 'Saving results']
        });
    }

    startBankDetection() {
        return this.startTask({
            title: 'Detecting Bank',
            description: 'Analyzing document to identify bank...',
            steps: ['Scanning text', 'Matching patterns', 'Calculating confidence']
        });
    }

    // Event dispatchers for easy use
    static dispatchStart(taskInfo) {
        window.dispatchEvent(new CustomEvent('progress-start', { detail: taskInfo }));
    }

    static dispatchUpdate(taskInfo) {
        window.dispatchEvent(new CustomEvent('progress-update', { detail: taskInfo }));
    }

    static dispatchComplete(taskInfo) {
        window.dispatchEvent(new CustomEvent('progress-complete', { detail: taskInfo }));
    }

    static dispatchError(taskInfo) {
        window.dispatchEvent(new CustomEvent('progress-error', { detail: taskInfo }));
    }
}

// Add CSS for progress tracker
const progressStyles = document.createElement('style');
progressStyles.textContent = `
    .progress-task {
        animation: slideIn 0.3s ease forwards;
    }
    
    .task-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
    }
    
    .task-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
    }
    
    .task-meta {
        display: flex;
        gap: 12px;
        font-size: 12px;
        color: #6B7280;
    }
    
    .task-description {
        font-size: 14px;
        color: #374151;
        margin-bottom: 12px;
    }
    
    .progress-bar-container {
        width: 100%;
        height: 6px;
        background: #E5E7EB;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 12px;
    }
    
    .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, #4F46E5, #7C3AED);
        border-radius: 3px;
        transition: width 0.3s ease;
    }
    
    .task-steps {
        display: flex;
        flex-direction: column;
        gap: 4px;
    }
    
    .step {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        padding: 2px 0;
    }
    
    .step.completed {
        color: #10B981;
    }
    
    .step.current {
        color: #4F46E5;
        font-weight: 500;
    }
    
    .step.pending {
        color: #9CA3AF;
    }
    
    .task-error {
        color: #EF4444;
        font-size: 12px;
        margin-top: 8px;
        padding: 8px;
        background: #FEF2F2;
        border-radius: 4px;
        border: 1px solid #FECACA;
    }
    
    @keyframes slideIn {
        from {
            transform: translateX(-100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(progressStyles);

// Export for use in other scripts
window.ProgressTracker = ProgressTracker;