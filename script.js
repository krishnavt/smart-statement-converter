// Smart Statement Converter - Main JavaScript
console.log('🔥 LATEST SCRIPT VERSION LOADED - BUILD 2025-12-16-v2 🔥');

class SmartStatementConverter {
    constructor() {
        this.currentUser = null;
        this.uploadedFiles = [];
        this.isProcessing = false;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupPlanToggle();
        
        // Force check auth status after a short delay to ensure DOM is ready
        setTimeout(() => {
            console.log('🔄 Force checking auth status...');
            this.checkAuthStatus();
        }, 100);
    }

    setupEventListeners() {
        // File upload - only on main page
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');

        if (uploadArea && fileInput && uploadBtn) {
            // Upload area click
            uploadArea.addEventListener('click', () => fileInput.click());
            uploadBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });

            // File input change
            fileInput.addEventListener('change', (e) => this.handleFileSelect(e.target.files));

            // Drag and drop
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            });

            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('dragover');
            });

            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                this.handleFileSelect(e.dataTransfer.files);
            });
        }

        // Note: Login/Register are now separate pages at /api/login and /api/register
        // No need for modal buttons or form submissions on main page

        // Plan buttons - only on main page
        const planButtons = document.querySelectorAll('.card-btn[data-plan]');
        planButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handlePlanPurchase(e.target.dataset.plan));
        });
    }

    setupPlanToggle() {
        const toggleBtns = document.querySelectorAll('.toggle-btn');
        if (toggleBtns.length > 0) {
            toggleBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    toggleBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    this.togglePricingPlan(btn.dataset.plan);
                });
            });
        }
    }

    togglePricingPlan(plan) {
        const monthlyElements = document.querySelectorAll('.monthly-limit, .monthly-price');
        const annualElements = document.querySelectorAll('.annual-limit, .annual-price');

        if (plan === 'annual') {
            monthlyElements.forEach(el => el.style.display = 'none');
            annualElements.forEach(el => el.style.display = 'block');
        } else {
            monthlyElements.forEach(el => el.style.display = 'block');
            annualElements.forEach(el => el.style.display = 'none');
        }
    }

    async handleFileSelect(files) {
        if (this.isProcessing) return;

        const validFiles = Array.from(files).filter(file => {
            if (file.type !== 'application/pdf') {
                this.showNotification('Only PDF files are allowed', 'error');
                return false;
            }
            if (file.size > 10 * 1024 * 1024) { // 10MB limit
                this.showNotification('File size must be less than 10MB', 'error');
                return false;
            }
            return true;
        });

        if (validFiles.length === 0) return;

        // Check user limits
        if (!this.checkUploadLimits(validFiles.length)) {
            return;
        }

        this.uploadedFiles = validFiles;
        await this.processFiles(validFiles);
    }

    checkUploadLimits(fileCount) {
        if (!this.currentUser) {
            // Anonymous user - 1 page per 24 hours
            const today = new Date().toDateString();
            const lastUpload = localStorage.getItem('lastAnonymousUpload');
            if (lastUpload === today) {
                this.showNotification('Anonymous users can only convert 1 page per 24 hours. Please register for more.', 'error');
                return false;
            }
            if (fileCount > 1) {
                this.showNotification('Anonymous users can only upload 1 file at a time', 'error');
                return false;
            }
        } else {
            // Check user subscription limits
            if (this.currentUser.subscription === 'free' && fileCount > 5) {
                this.showNotification('Free users can only convert 5 pages per 24 hours', 'error');
                return false;
            }
        }
        return true;
    }

    async processFiles(files) {
        this.isProcessing = true;
        this.showLoading(true);
        
        try {
            const results = [];
            for (const file of files) {
                const result = await this.convertPDFToCSV(file);
                results.push(result);
            }
            
            this.displayResults(results);
            this.updateUserUsage(files.length);
            
        } catch (error) {
            console.error('Processing error:', error);
            this.showNotification('Error processing files. Please try again.', 'error');
        } finally {
            this.isProcessing = false;
            this.showLoading(false);
        }
    }

    async convertPDFToCSV(file) {
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            
            const response = await fetch('/api/convert', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Conversion failed');
            }
            
            const result = await response.json();
            
            return {
                filename: result.filename,
                csvData: result.csvData,
                originalFile: file,
                transactionCount: result.transactionCount
            };
            
        } catch (error) {
            console.error('PDF conversion error:', error);
            throw error;
        }
    }

    generateMockCSVData(filename) {
        // Generate mock bank statement data
        const headers = ['DATE', 'TYPE', 'DESCRIPTION', 'AMOUNT', 'BALANCE'];
        const transactions = [
            ['Aug 31, 2025', 'Interest Earned', 'Interest earned Transaction ID: 154-1', '0.49', '450.04'],
            ['Aug 22, 2025', 'Withdrawal', 'To Savings - 8443 Transaction ID: 153-65331001', '-1000.00', '449.55'],
            ['Aug 19, 2025', 'Withdrawal', 'To Savings - 8443 Transaction ID: 152-153835001', '-2000.00', '1449.55'],
            ['Aug 13, 2025', 'Deposit', 'From Savings - 8443 Transaction ID: 151-257238002', '3000.00', '3449.55'],
            ['Aug 13, 2025', 'Direct Payment', 'PROTECTIVE LIFE INS. PREM. Transaction ID: 150-23087001', '-43.34', '449.55'],
            ['Aug 7, 2025', 'Direct Payment', 'PAYPAL INST XFER Transaction ID: 148-185007001', '-13.26', '492.89'],
            ['Aug 31, 2025', 'Interest Earned', 'Interest earned Transaction ID: 373-1', '9.36', '6164.15'],
            ['Aug 27, 2025', 'Direct Deposit', 'CHEWY PAYROLL Transaction ID: 372-552058001', '5698.80', '6154.79'],
            ['Aug 26, 2025', 'Direct Payment', 'PUGET SOUND ENER BILLPAY Transaction ID: 371-313795001', '-255.00', '455.99'],
            ['Aug 25, 2025', 'Direct Payment', 'CITI CARD ONLINE PAYMENT Transaction ID: 370-212001', '-239.82', '710.99'],
            ['Aug 25, 2025', 'Direct Payment', 'FID BKG SVC LLC MONEYLINE Transaction ID: 369-71559001', '-130.00', '950.81'],
            ['Aug 22, 2025', 'Deposit', 'From Checking - 7487 Transaction ID: 367-65331002', '1000.00', '1080.81']
        ];

        const csvContent = [headers, ...transactions]
            .map(row => row.map(cell => `"${cell}"`).join(','))
            .join('\\n');

        return csvContent;
    }

    displayResults(results) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsGrid = document.getElementById('resultsGrid');
        
        resultsGrid.innerHTML = '';
        
        results.forEach(result => {
            const resultItem = document.createElement('div');
            resultItem.className = 'result-item';
            
            resultItem.innerHTML = `
                <div class="result-header">
                    <span class="result-filename">${result.filename}</span>
                    <button class="download-btn" onclick="downloadCSV('${result.filename}', \`${result.csvData}\`)">
                        Download CSV
                    </button>
                </div>
                <div class="result-preview">
                    <pre>${this.formatCSVPreview(result.csvData)}</pre>
                </div>
            `;
            
            resultsGrid.appendChild(resultItem);
        });
        
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    formatCSVPreview(csvData) {
        const lines = csvData.split('\\n');
        return lines.slice(0, 6).join('\\n') + (lines.length > 6 ? '\\n... (showing first 6 rows)' : '');
    }

    updateUserUsage(fileCount) {
        if (!this.currentUser) {
            // Update anonymous usage
            localStorage.setItem('lastAnonymousUpload', new Date().toDateString());
        } else {
            // Update user usage in database
            // This would be implemented with your backend
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            // Simulate login - replace with actual authentication
            await this.simulateAuth();
            this.currentUser = { email, subscription: 'free' };
            this.closeModal('loginModal');
            this.updateAuthUI();
            this.showNotification('Logged in successfully!', 'success');
        } catch (error) {
            this.showNotification('Login failed. Please check your credentials.', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            this.showNotification('Passwords do not match', 'error');
            return;
        }

        try {
            // Simulate registration - replace with actual registration
            await this.simulateAuth();
            this.currentUser = { email, subscription: 'free' };
            this.closeModal('registerModal');
            this.updateAuthUI();
            this.showNotification('Account created successfully!', 'success');
        } catch (error) {
            this.showNotification('Registration failed. Please try again.', 'error');
        }
    }

    async simulateAuth() {
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }

    async handlePlanPurchase(plan) {
        if (!this.currentUser) {
            this.showNotification('Please login or register first', 'error');
            this.showModal('loginModal');
            return;
        }

        try {
            this.showLoading(true);
            
            // Get current billing cycle (monthly/annual)
            const billingCycle = document.querySelector('.toggle-btn.active').dataset.plan === 'annual' ? 'annual' : 'monthly';
            
            // Create payment intent
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    plan: plan,
                    billingCycle: billingCycle
                })
            });
            
            if (!response.ok) {
                throw new Error('Failed to create payment intent');
            }
            
            const { clientSecret } = await response.json();
            
            // In a real implementation, you would use Stripe Elements here
            // For demo purposes, we'll simulate the payment
            this.showNotification(`Processing ${plan} ${billingCycle} subscription...`, 'info');
            
            // Simulate successful payment
            setTimeout(() => {
                this.showNotification('Payment successful! Your plan has been upgraded.', 'success');
                this.currentUser.subscription = plan;
                this.currentUser.billingCycle = billingCycle;
                this.updateAuthUI();
                this.showLoading(false);
            }, 2000);
            
        } catch (error) {
            console.error('Payment error:', error);
            this.showNotification('Payment failed. Please try again.', 'error');
            this.showLoading(false);
        }
    }

    checkAuthStatus() {
        console.log('🔍 Checking auth status...');
        // Check if user is logged in with Google auth
        const userToken = localStorage.getItem('userToken');
        const userData = localStorage.getItem('userData');
        
        console.log('🔍 UserToken exists:', !!userToken);
        console.log('🔍 UserData exists:', !!userData);
        console.log('🔍 UserData content:', userData);
        
        if (userToken && userData) {
            try {
                this.currentUser = JSON.parse(userData);
                console.log('🔍 Parsed user:', this.currentUser);
                this.updateAuthUI();
            } catch (error) {
                console.error('❌ Error parsing user data:', error);
                this.logout();
            }
        } else {
            console.log('🔍 No user authentication found');
        }
    }

    updateAuthUI() {
        console.log('🔄 Updating auth UI for user:', this.currentUser);
        const navMenu = document.querySelector('.nav-menu');
        console.log('🔄 Nav menu found:', !!navMenu);
        
        if (this.currentUser && navMenu) {
            // Check if user menu already exists
            const existingUserMenu = navMenu.querySelector('.user-menu');
            console.log('🔄 Existing user menu found:', !!existingUserMenu);
            
            if (existingUserMenu) {
                console.log('🔄 User menu already exists, skipping update');
                return;
            }
            
            const loginLink = navMenu.querySelector('a[href="/api/login"]');
            const registerLink = navMenu.querySelector('a[href="/api/register"]');
            console.log('🔄 Login link found:', !!loginLink);
            console.log('🔄 Register link found:', !!registerLink);
            
            if (loginLink && registerLink) {
                // Create user menu HTML
                const userMenuHTML = \`
                    <div class="user-menu" style="display: flex; align-items: center; gap: 1rem;">
                        <img src="\${this.currentUser.picture}" alt="\${this.currentUser.name}" 
                             style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #E5E7EB;">
                        <span style="font-weight: 500; color: #374151;">\${this.currentUser.name}</span>
                        <button onclick="app.logout()" style="background: #EF4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
                            Logout
                        </button>
                    </div>
                \`;
                
                // Replace both links with user menu
                registerLink.remove();
                loginLink.outerHTML = userMenuHTML;
                console.log('🔄 Successfully replaced login/register links with user menu');
            } else {
                console.log('🔄 Could not find login/register links to replace');
            }
        } else if (!this.currentUser) {
            console.log('🔄 No current user, skipping UI update');
        } else if (!navMenu) {
            console.log('🔄 Nav menu not found, skipping UI update');
        }
    }

    logout() {
        // Clear stored auth data
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        this.currentUser = null;
        
        // Redirect to home page
        window.location.href = '/';
    }

    showModal(modalId) {
        document.getElementById(modalId).classList.add('show');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('show');
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.add('show');
        } else {
            overlay.classList.remove('show');
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('.notification-styles')) {
            const styles = document.createElement('style');
            styles.className = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 2rem;
                    right: 2rem;
                    padding: 1rem 1.5rem;
                    border-radius: 0.5rem;
                    color: white;
                    font-weight: 500;
                    z-index: 3000;
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    max-width: 400px;
                    animation: slideIn 0.3s ease;
                }
                .notification-success { background: #10b981; }
                .notification-error { background: #ef4444; }
                .notification-info { background: #3b82f6; }
                .notification button {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 0;
                    margin-left: auto;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

// Global functions
function downloadCSV(filename, csvData) {
    const blob = new Blob([csvData], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function startAnonymousConversion() {
    document.getElementById('uploadArea').scrollIntoView({ behavior: 'smooth' });
}

function showRegister() {
    if (app && app.showModal) {
        app.showModal('registerModal');
    }
}

function contactEnterprise() {
    window.open('mailto:contact@smartstatementconverter.net?subject=Enterprise Inquiry', '_blank');
}

function contactSupport() {
    window.open('mailto:support@smartstatementconverter.net?subject=Support Request', '_blank');
}

function switchToRegister() {
    if (app && app.closeModal && app.showModal) {
        app.closeModal('loginModal');
        app.showModal('registerModal');
    }
}

function switchToLogin() {
    if (app && app.closeModal && app.showModal) {
        app.closeModal('registerModal');
        app.showModal('loginModal');
    }
}

function closeModal(modalId) {
    if (app && app.closeModal) {
        app.closeModal(modalId);
    }
}

// Initialize app when DOM is ready - only on main page
let app;

function initializeApp() {
    // Check if we're on the main page (has upload area) vs login/register pages
    const isMainPage = document.getElementById('uploadArea') !== null;
    const isLoginPage = window.location.pathname.includes('/api/login');
    const isRegisterPage = window.location.pathname.includes('/api/register');
    
    console.log('🚀 Page type:', { isMainPage, isLoginPage, isRegisterPage });
    
    if (isMainPage) {
        console.log('🚀 Main page detected, initializing SmartStatementConverter...');
        app = new SmartStatementConverter();
    } else {
        console.log('🚀 Login/Register page detected, skipping SmartStatementConverter initialization');
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);

// Fallback for already loaded DOM
if (document.readyState === 'loading') {
    // DOM is still loading, wait for DOMContentLoaded
} else {
    // DOM is already loaded
    initializeApp();
}

// Add modal close functionality
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// Escape key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.show').forEach(modal => {
            modal.classList.remove('show');
        });
    }
});