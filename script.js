// Smart Statement Converter - Main JavaScript (Lightweight)
console.log('🔥 LATEST SCRIPT VERSION LOADED - BUILD 2025-01-16-v3 🔥');

class SmartStatementConverter {
    constructor() {
        this.currentUser = null;
        this.uploadedFiles = [];
        this.isProcessing = false;
        this.currentPage = 1;
        this.rowsPerPage = 10;
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.currentCSVData = null;
        this.stripe = null;
        this.elements = null;
        this.paymentElement = null;
        this.currentPaymentIntent = null;
        
        // Initialize utilities
        this.uiUtils = new UIUtils();
        this.smartFeatures = new SmartFeatures();
        this.errorHandler = new ErrorHandler(this.uiUtils);
        this.progressTracker = new ProgressTracker(this.uiUtils);
        this.analytics = new Analytics();
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkAuthStatus();
        this.setupPlanToggle();
        this.initializeStripe();
        
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

            // Plan buttons - only on main page
            const planButtons = document.querySelectorAll('.card-btn[data-plan]');
            planButtons.forEach(btn => {
                btn.addEventListener('click', (e) => this.handlePlanPurchase(e.target.dataset.plan));
            });
        }

        // Note: Login/Register are now separate pages at /api/login and /api/register
        // No need for modal buttons or form submissions on main page
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
        if (this.isProcessing) {
            this.showNotification('Please wait for current processing to complete', 'warning');
            return;
        }

        if (!files || files.length === 0) {
            this.showNotification('No files selected', 'warning');
            return;
        }

        const validFiles = [];
        const errors = [];

        for (const file of Array.from(files)) {
            const validation = this.validateFile(file);
            if (validation.isValid) {
                validFiles.push(file);
            } else {
                errors.push(`${file.name}: ${validation.error}`);
            }
        }

        // Show validation errors
        if (errors.length > 0) {
            const errorMessage = errors.length === 1 
                ? errors[0] 
                : `Multiple files have issues:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n... and ${errors.length - 3} more` : ''}`;
            this.showNotification(errorMessage, 'error', 8000);
        }

        if (validFiles.length === 0) {
            this.showNotification('No valid files to process', 'warning');
            return;
        }

        // Check user limits
        if (!this.checkUploadLimits(validFiles.length)) {
            return;
        }

        // Show success message for valid files
        if (validFiles.length > 0) {
            this.showNotification(
                `✅ ${validFiles.length} valid file${validFiles.length > 1 ? 's' : ''} ready for processing`, 
                'success', 
                3000
            );
        }

        this.uploadedFiles = validFiles;
        await this.processFiles(validFiles);
    }

    validateFile(file) {
        // Check if file exists
        if (!file) {
            return { isValid: false, error: 'File is null or undefined' };
        }

        // Check file type
        if (file.type !== 'application/pdf') {
            return { isValid: false, error: 'Only PDF files are allowed' };
        }

        // Check file size (10MB limit)
        const maxSize = 10 * 1024 * 1024; // 10MB
        if (file.size > maxSize) {
            const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
            return { isValid: false, error: `File too large (${sizeMB}MB). Maximum size is 10MB` };
        }

        // Check if file is empty
        if (file.size === 0) {
            return { isValid: false, error: 'File is empty' };
        }

        // Check file name
        if (!file.name || file.name.trim() === '') {
            return { isValid: false, error: 'File has no name' };
        }

        // Check for suspicious file names
        const suspiciousPatterns = [
            /\.exe$/i, /\.bat$/i, /\.cmd$/i, /\.scr$/i, /\.pif$/i,
            /\.com$/i, /\.vbs$/i, /\.js$/i, /\.jar$/i, /\.app$/i
        ];
        
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(file.name)) {
                return { isValid: false, error: 'File type not allowed for security reasons' };
            }
        }

        // Check for very long file names
        if (file.name.length > 255) {
            return { isValid: false, error: 'File name too long (max 255 characters)' };
        }

        // Check for special characters in filename that might cause issues
        const dangerousChars = /[<>:"/\\|?*\x00-\x1f]/;
        if (dangerousChars.test(file.name)) {
            return { isValid: false, error: 'File name contains invalid characters' };
        }

        return { isValid: true, error: null };
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
            if (this.currentUser.subscription?.planType === 'free' && fileCount > 5) {
                this.showNotification('Free users can only convert 5 pages per 24 hours', 'error');
                return false;
            }
        }
        return true;
    }

    async processFiles(files) {
        this.isProcessing = true;
        this.showLoading(true);
        
        // Show initial processing notification
        const loadingNotification = this.showLoadingNotification(
            `Processing ${files.length} file${files.length > 1 ? 's' : ''}...`, 
            'file-processing'
        );
        
        try {
            const results = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                // Update progress notification
                this.hideLoadingNotification('file-processing');
                const progressNotification = this.showLoadingNotification(
                    `Processing file ${i + 1} of ${files.length}: ${file.name}`, 
                    'file-processing'
                );
                
                try {
                    const result = await this.convertPDFToCSV(file);
                    results.push(result);
                    
                    // Show success for individual file
                    this.hideLoadingNotification('file-processing');
                    this.showNotification(
                        `✅ ${file.name} processed successfully (${result.transactionCount} transactions found)`, 
                        'success', 
                        3000
                    );
                    
                } catch (fileError) {
                    console.error(`Error processing ${file.name}:`, fileError);
                    this.hideLoadingNotification('file-processing');
                    this.showNotification(
                        `❌ Failed to process ${file.name}: ${fileError.message}`, 
                        'error', 
                        5000
                    );
                    // Continue with other files
                }
            }
            
            if (results.length > 0) {
                this.displayResults(results);
                this.updateUserUsage(results.length);
                this.showNotification(
                    `🎉 Successfully processed ${results.length} of ${files.length} files!`, 
                    'success', 
                    4000
                );
            } else {
                this.showNotification(
                    '❌ No files were processed successfully. Please check your PDF files and try again.', 
                    'error', 
                    6000
                );
            }
            
        } catch (error) {
            console.error('Processing error:', error);
            this.hideLoadingNotification('file-processing');
            this.showNotification(
                `Error processing files: ${error.message}`, 
                'error', 
                6000
            );
        } finally {
            this.isProcessing = false;
            this.showLoading(false);
            this.hideLoadingNotification('file-processing');
        }
    }

    async convertPDFToCSV(file) {
        try {
            const formData = new FormData();
            formData.append('pdf', file);
            
            // Add user ID for history tracking
            const userId = this.currentUser ? this.currentUser.id : '00000000-0000-0000-0000-000000000000';
            formData.append('userId', userId);
            
            const response = await fetch('/api/convert', {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || 'Conversion failed');
            }
            
            const result = await response.json();
            
            // Use smart features to enhance the result
            const enhancedResult = this.enhanceWithSmartFeatures(result, file);
            
            return enhancedResult;
            
        } catch (error) {
            console.error('PDF conversion error:', error);
            throw error;
        }
    }

    enhanceWithSmartFeatures(result, file) {
        try {
            // Parse the CSV data to extract text for bank detection
            const csvText = result.csvData || '';
            const bankInfo = this.smartFeatures.detectBank(csvText);
            
            // Enhanced result with smart features
            return {
                filename: result.filename,
                csvData: result.csvData,
                originalFile: file,
                transactionCount: result.transactionCount,
                bankInfo: bankInfo,
                smartFeatures: {
                    bankDetected: bankInfo.bank,
                    confidence: bankInfo.confidence,
                    exportFormats: ['csv', 'excel', 'json'],
                    autoSave: true
                }
            };
        } catch (error) {
            console.error('Error enhancing with smart features:', error);
            // Return original result if enhancement fails
            return {
                filename: result.filename,
                csvData: result.csvData,
                originalFile: file,
                transactionCount: result.transactionCount,
                bankInfo: { bank: 'Unknown', confidence: 0 },
                smartFeatures: {
                    bankDetected: 'Unknown',
                    confidence: 0,
                    exportFormats: ['csv'],
                    autoSave: false
                }
            };
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
        
        // Store CSV data for pagination and sorting
        this.storedCSVData = {};
        results.forEach(result => {
            this.storedCSVData[result.filename] = {
                csvData: result.csvData,
                sortColumn: null,
                sortDirection: 'asc',
                currentPage: 1
            };
        });
        
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
                    ${this.formatCSVTable(result.csvData, 1, 10, null, 'asc')}
                </div>
            `;
            
            resultsGrid.appendChild(resultItem);
        });
        
        // Add event delegation for sorting
        this.setupSortingEventListeners();
        
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    formatCSVTable(csvData, page = 1, rowsPerPage = 10, sortColumn = null, sortDirection = 'asc') {
        // Debug: Log the CSV data
        console.log('CSV Data received:', csvData);
        console.log('CSV Data length:', csvData.length);
        
        // Fix the line splitting - use actual newlines, not escaped ones
        const lines = csvData.split('\n').filter(line => line.trim());
        console.log('Lines after split:', lines.length);
        console.log('First few lines:', lines.slice(0, 3));
        
        if (lines.length === 0) return '<p>No data available</p>';
        
        // Parse CSV data properly
        const rows = lines.map(line => {
            const cells = [];
            let current = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    cells.push(current.trim());
                    current = '';
                } else {
                    current += char;
                }
            }
            cells.push(current.trim());
            return cells;
        });
        
        if (rows.length === 0) return '<p>No data available</p>';
        
        const headers = rows[0];
        let dataRows = rows.slice(1);
        
        // Apply sorting if specified
        if (sortColumn !== null && sortColumn >= 0 && sortColumn < headers.length) {
            dataRows.sort((a, b) => {
                let aVal = a[sortColumn] || '';
                let bVal = b[sortColumn] || '';
                
                // Clean values for comparison
                aVal = aVal.replace(/"/g, '').trim();
                bVal = bVal.replace(/"/g, '').trim();
                
                // Handle numeric values (amounts, balances)
                const aNum = parseFloat(aVal.replace(/[$,]/g, ''));
                const bNum = parseFloat(bVal.replace(/[$,]/g, ''));
                
                if (!isNaN(aNum) && !isNaN(bNum)) {
                    return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
                }
                
                // Handle dates
                const aDate = new Date(aVal);
                const bDate = new Date(bVal);
                
                if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
                    return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
                }
                
                // Handle text
                return sortDirection === 'asc' 
                    ? aVal.toLowerCase().localeCompare(bVal.toLowerCase())
                    : bVal.toLowerCase().localeCompare(aVal.toLowerCase());
            });
        }
        
        const totalRows = dataRows.length;
        const totalPages = Math.ceil(totalRows / rowsPerPage);
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = Math.min(startIndex + rowsPerPage, dataRows.length);
        const displayRows = dataRows.slice(startIndex, endIndex);
        
        let tableHTML = `
            <div class="table-container" style="overflow-x: auto; margin: 1rem 0;">
                <table class="conversion-table" style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 0.875rem;">
                    <thead>
                        <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0;">
        `;
        
        // Add sortable headers
        headers.forEach((header, index) => {
            const cleanHeader = header.replace(/"/g, '');
            const isCurrentSort = sortColumn === index;
            const sortIcon = isCurrentSort ? (sortDirection === 'asc' ? '↑' : '↓') : '↕';
            const nextDirection = isCurrentSort ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
            
            tableHTML += `
                <th class="sortable-header" data-column="${index}" data-direction="${nextDirection}" 
                    style="padding: 0.75rem; text-align: left; font-weight: 600; color: #374151; border-right: 1px solid #e2e8f0; cursor: pointer; user-select: none; position: relative;" 
                    onmouseover="this.style.backgroundColor='#e2e8f0'" 
                    onmouseout="this.style.backgroundColor='#f8fafc'">
                    ${cleanHeader}
                    <span style="margin-left: 0.5rem; font-size: 0.75rem; opacity: ${isCurrentSort ? '1' : '0.5'};">${sortIcon}</span>
                </th>
            `;
        });
        
        tableHTML += `
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        // Add data rows
        displayRows.forEach((row, index) => {
            const rowClass = index % 2 === 0 ? 'even' : 'odd';
            tableHTML += `<tr class="${rowClass}" style="background: ${index % 2 === 0 ? '#ffffff' : '#f8fafc'}; border-bottom: 1px solid #e2e8f0;">`;
            
            row.forEach(cell => {
                const cleanCell = cell.replace(/"/g, '');
                const isAmount = cleanCell.match(/^-?\d+\.\d{2}$/);
                const isDate = cleanCell.match(/^[A-Za-z]{3} \d{1,2}, \d{4}$/);
                
                let cellStyle = 'padding: 0.75rem; border-right: 1px solid #e2e8f0; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
                
                if (isAmount) {
                    const amount = parseFloat(cleanCell);
                    cellStyle += ` color: ${amount < 0 ? '#dc2626' : '#059669'}; font-weight: 500;`;
                } else if (isDate) {
                    cellStyle += ' color: #6b7280;';
                } else {
                    cellStyle += ' color: #374151;';
                }
                
                tableHTML += `<td style="${cellStyle}" title="${cleanCell}">${cleanCell}</td>`;
            });
            
            tableHTML += '</tr>';
        });
        
        tableHTML += `
                    </tbody>
                </table>
            </div>
        `;
        
        // Add pagination controls
        if (totalPages > 1) {
            tableHTML += this.generatePaginationControls(page, totalPages, totalRows, rowsPerPage);
        } else {
            tableHTML += `<p style="text-align: center; color: #6b7280; font-size: 0.875rem; margin-top: 1rem;">Showing all ${totalRows} rows</p>`;
        }
        
        return tableHTML;
    }

    generatePaginationControls(currentPage, totalPages, totalRows, rowsPerPage) {
        const startRow = (currentPage - 1) * rowsPerPage + 1;
        const endRow = Math.min(currentPage * rowsPerPage, totalRows);
        
        let paginationHTML = `
            <div class="pagination-container" style="display: flex; justify-content: space-between; align-items: center; margin-top: 1rem; padding: 1rem; background: #f8fafc; border-radius: 8px;">
                <div class="pagination-info" style="color: #6b7280; font-size: 0.875rem;">
                    Showing ${startRow}-${endRow} of ${totalRows} rows
                </div>
                <div class="pagination-controls" style="display: flex; gap: 0.5rem; align-items: center;">
        `;
        
        // Previous button
        if (currentPage > 1) {
            paginationHTML += `
                <button onclick="app.changePage(${currentPage - 1})" 
                        style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; color: #374151;">
                    ← Previous
                </button>
            `;
        } else {
            paginationHTML += `
                <button disabled style="padding: 0.5rem 1rem; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 6px; cursor: not-allowed; font-size: 0.875rem; color: #9ca3af;">
                    ← Previous
                </button>
            `;
        }
        
        // Page numbers
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                paginationHTML += `
                    <button style="padding: 0.5rem 1rem; border: 1px solid #4f46e5; background: #4f46e5; color: white; border-radius: 6px; font-size: 0.875rem; font-weight: 500;">
                        ${i}
                    </button>
                `;
            } else {
                paginationHTML += `
                    <button onclick="app.changePage(${i})" 
                            style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; color: #374151;">
                        ${i}
                    </button>
                `;
            }
        }
        
        // Next button
        if (currentPage < totalPages) {
            paginationHTML += `
                <button onclick="app.changePage(${currentPage + 1})" 
                        style="padding: 0.5rem 1rem; border: 1px solid #d1d5db; background: white; border-radius: 6px; cursor: pointer; font-size: 0.875rem; color: #374151;">
                    Next →
                </button>
            `;
        } else {
            paginationHTML += `
                <button disabled style="padding: 0.5rem 1rem; border: 1px solid #e5e7eb; background: #f9fafb; border-radius: 6px; cursor: not-allowed; font-size: 0.875rem; color: #9ca3af;">
                    Next →
                </button>
            `;
        }
        
        paginationHTML += `
                </div>
            </div>
        `;
        
        return paginationHTML;
    }

    changePage(newPage) {
        // Find the current result item and update its table
        const resultsGrid = document.getElementById('resultsGrid');
        const resultItems = resultsGrid.querySelectorAll('.result-item');
        
        resultItems.forEach(item => {
            const filename = item.querySelector('.result-filename').textContent;
            const fileData = this.storedCSVData?.[filename];
            
            if (fileData) {
                fileData.currentPage = newPage;
                const previewDiv = item.querySelector('.result-preview');
                previewDiv.innerHTML = this.formatCSVTable(
                    fileData.csvData, 
                    newPage, 
                    10, 
                    fileData.sortColumn, 
                    fileData.sortDirection
                );
            }
        });
    }

    setupSortingEventListeners() {
        // Use event delegation to handle sorting clicks
        const resultsGrid = document.getElementById('resultsGrid');
        if (resultsGrid) {
            resultsGrid.addEventListener('click', (e) => {
                if (e.target.closest('.sortable-header')) {
                    const header = e.target.closest('.sortable-header');
                    const columnIndex = parseInt(header.dataset.column);
                    const direction = header.dataset.direction;
                    this.sortTable(columnIndex, direction);
                }
            });
        }
    }

    sortTable(columnIndex, direction) {
        // Find the current result item and update its table
        const resultsGrid = document.getElementById('resultsGrid');
        const resultItems = resultsGrid.querySelectorAll('.result-item');
        
        resultItems.forEach(item => {
            const filename = item.querySelector('.result-filename').textContent;
            const fileData = this.storedCSVData?.[filename];
            
            if (fileData) {
                fileData.sortColumn = columnIndex;
                fileData.sortDirection = direction;
                fileData.currentPage = 1; // Reset to first page when sorting
                
                const previewDiv = item.querySelector('.result-preview');
                previewDiv.innerHTML = this.formatCSVTable(
                    fileData.csvData, 
                    fileData.currentPage, 
                    10, 
                    fileData.sortColumn, 
                    fileData.sortDirection
                );
                
                // Re-setup event listeners for the new table
                this.setupSortingEventListeners();
            }
        });
    }

    getCSVDataForFile(filename) {
        // This would need to be implemented to store/retrieve CSV data
        // For now, we'll need to modify the displayResults function to store the data
        return this.storedCSVData?.[filename];
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
        // Redirect to Google OAuth
        this.initiateGoogleAuth();
    }

    async handleRegister(e) {
        e.preventDefault();
        // Redirect to Google OAuth
        this.initiateGoogleAuth();
    }

    async simulateAuth() {
        return new Promise((resolve) => setTimeout(resolve, 1000));
    }

    async initiateGoogleAuth() {
        try {
            // Load Google OAuth script if not already loaded
            if (!window.google) {
                await this.loadGoogleScript();
            }

            // Initialize Google OAuth
            window.google.accounts.oauth2.initTokenClient({
                client_id: '429528699130-o1c495n7gr2e15iq6rpg16qgf5prkiu5.apps.googleusercontent.com',
                scope: 'email profile',
                callback: this.handleGoogleAuthResponse.bind(this)
            }).requestAccessToken();
        } catch (error) {
            console.error('❌ Google OAuth initialization failed:', error);
            this.showNotification('Google authentication failed. Please try again.', 'error');
        }
    }

    async loadGoogleScript() {
        return new Promise((resolve, reject) => {
            if (window.google) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'https://accounts.google.com/gsi/client';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async handleGoogleAuthResponse(response) {
        try {
            console.log('🔄 Google OAuth response received');
            
            if (response.error) {
                throw new Error(response.error);
            }

            // Send the credential to our backend
            const backendResponse = await fetch('/api/auth/google', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    credential: response.credential
                })
            });

            const result = await backendResponse.json();

            if (result.success) {
                // Store user data and token
                this.currentUser = {
                    ...result.user,
                    subscription: { planType: 'free' } // Default subscription
                };
                
                localStorage.setItem('userData', JSON.stringify(this.currentUser));
                localStorage.setItem('userToken', result.token);
                
                console.log('✅ Google authentication successful:', this.currentUser);
                
                // Update UI
                this.updateAuthUI();
                this.hidePricingForMembers();
                this.updateMembershipDisplay();
                
                // Load subscription from database
                await this.loadSubscriptionFromDatabase();
                this.updateMembershipDisplay();
                
                this.showNotification('Login successful!', 'success');
                
                // Close any open modals
                this.closeModal('loginModal');
                this.closeModal('registerModal');
            } else {
                throw new Error(result.message || 'Authentication failed');
            }
        } catch (error) {
            console.error('❌ Google authentication failed:', error);
            this.showNotification('Authentication failed. Please try again.', 'error');
        }
    }

    generateUserId() {
        // Generate a UUID v4 for the user
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c == 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    async handlePlanPurchase(plan) {
        if (!this.currentUser) {
            this.showNotification('Please login or register first', 'error');
            this.showModal('loginModal');
            return;
        }

        // Get current billing cycle (monthly/annual)
        const billingCycle = document.querySelector('.toggle-btn.active').dataset.plan === 'annual' ? 'annual' : 'monthly';
        
        // Show the Stripe payment modal
        await this.showPaymentModal(plan, billingCycle);
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
                
                // Always update membership display and pricing visibility
                console.log('🔄 About to call updateMembershipDisplay');
                this.updateMembershipDisplay();
                console.log('🔄 About to call hidePricingForMembers');
                this.hidePricingForMembers();
            } catch (error) {
                console.error('❌ Error parsing user data:', error);
                this.logout();
            }
        } else {
            console.log('🔍 No user authentication found');
            // Show pricing for non-members
            this.showPricingForNonMembers();
            // Always update membership display (will show free plan for non-authenticated users)
            this.updateMembershipDisplay();
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
                console.log('🔄 User menu already exists, updating membership display only');
                // Update membership display and pricing visibility even if menu exists
                this.updateMembershipDisplay();
                this.hidePricingForMembers();
                return;
            }
            
            const loginLink = navMenu.querySelector('a[href="/api/login"]');
            const registerLink = navMenu.querySelector('a[href="/api/register"]');
            console.log('🔄 Login link found:', !!loginLink);
            console.log('🔄 Register link found:', !!registerLink);
            
            if (loginLink && registerLink) {
                // Create user menu HTML
                const userMenuHTML = `
                    <div class="user-menu" style="display: flex; align-items: center; gap: 1rem;">
                        <a href="/profile.html" style="display: flex; align-items: center; gap: 0.5rem; text-decoration: none; cursor: pointer; padding: 0.25rem; border-radius: 6px; transition: background-color 0.2s ease;" onmouseover="this.style.backgroundColor='#f3f4f6'" onmouseout="this.style.backgroundColor='transparent'">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: #4F46E5; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 14px;">
                                ${this.currentUser.name.charAt(0).toUpperCase()}
                            </div>
                            <span style="font-weight: 500; color: #374151;">${this.currentUser.name}</span>
                        </a>
                        <button onclick="app.logout()" style="background: #EF4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; font-size: 0.875rem;">
                            Logout
                        </button>
                    </div>
                `;
                
                // Replace both links with user menu
                registerLink.remove();
                loginLink.outerHTML = userMenuHTML;
                console.log('🔄 Successfully replaced login/register links with user menu');
                
                // Update membership display and pricing visibility
                this.updateMembershipDisplay();
                this.hidePricingForMembers();
            } else {
                console.log('🔄 Could not find login/register links to replace');
            }
        } else if (!this.currentUser) {
            console.log('🔄 No current user, skipping UI update');
            // Show pricing for non-members
            this.showPricingForNonMembers();
        } else if (!navMenu) {
            console.log('🔄 Nav menu not found, skipping UI update');
        }
    }

    updateMembershipDisplay() {
        console.log('🔄 updateMembershipDisplay called');
        console.log('🔄 Current page:', window.location.pathname);
        console.log('🔄 Current user:', this.currentUser);
        console.log('🔄 User subscription:', this.currentUser?.subscription);
        
        // Only update membership display on profile page
        if (!window.location.pathname.includes('profile')) {
            console.log('🔄 Not on profile page, skipping membership display update');
            return;
        }
        
        // If no user or subscription, show free plan
        if (!this.currentUser || !this.currentUser.subscription) {
            console.log('🔄 No user or subscription found, showing free plan');
            this.showFreePlan();
            return;
        }
        
        const membershipCard = document.getElementById('membershipCard');
        const planName = document.getElementById('planName');
        const planStatus = document.getElementById('planStatus');
        const planLimits = document.getElementById('planLimits');
        const billingCycle = document.getElementById('billingCycle');
        const renewalDate = document.getElementById('renewalDate');
        const upgradeBtn = document.getElementById('upgradeBtn');
        const manageBtn = document.getElementById('manageBtn');
        
        console.log('🔄 Found membershipCard:', !!membershipCard);
        console.log('🔄 Found planName:', !!planName);
        console.log('🔄 Found planStatus:', !!planStatus);
        console.log('🔄 Found planLimits:', !!planLimits);
        console.log('🔄 Found billingCycle:', !!billingCycle);
        console.log('🔄 Found renewalDate:', !!renewalDate);
        console.log('🔄 Found upgradeBtn:', !!upgradeBtn);
        console.log('🔄 Found manageBtn:', !!manageBtn);
        
        if (!membershipCard) {
            console.log('🔄 No membershipCard found, returning');
            console.log('🔄 Available elements with "membership" in ID:', 
                Array.from(document.querySelectorAll('[id*="membership"]')).map(el => el.id));
            return;
        }
        
        // Ensure membership card is visible
        membershipCard.style.display = 'flex';
        membershipCard.style.visibility = 'visible';
        membershipCard.style.opacity = '1';
        console.log('🔄 Ensured membershipCard is visible');
        
        const subscription = this.currentUser.subscription;
        const planType = subscription.planType || 'free';
        
        // Update plan styling
        membershipCard.className = `membership-card ${planType}-plan`;
        
        // Update plan details
        if (planName) {
            const displayName = this.getPlanDisplayName(planType);
            planName.textContent = displayName;
            console.log('🔄 Updated planName to:', displayName);
        }
        
        if (planStatus) {
            const status = subscription.status || 'Active';
            planStatus.textContent = status;
            console.log('🔄 Updated planStatus to:', status);
        }
        
        if (planLimits) {
            const limits = this.getPlanLimits(planType);
            planLimits.textContent = limits;
            console.log('🔄 Updated planLimits to:', limits);
        }
        
        if (billingCycle) {
            let billingText;
            if (planType === 'free') {
                billingText = 'No billing cycle';
            } else {
                billingText = `${subscription.billingCycle || 'monthly'} billing`;
            }
            billingCycle.textContent = billingText;
            console.log('🔄 Updated billingCycle to:', billingText);
        }
        
        if (renewalDate) {
            let renewalText;
            if (planType === 'free') {
                renewalText = 'No renewal date';
            } else if (subscription.currentPeriodEnd) {
                const date = new Date(subscription.currentPeriodEnd);
                renewalText = `Renews ${date.toLocaleDateString()}`;
            } else {
                renewalText = 'No renewal date';
            }
            renewalDate.textContent = renewalText;
            console.log('🔄 Updated renewalDate to:', renewalText);
        }
        
        // Update action buttons
        if (upgradeBtn && manageBtn) {
            if (planType === 'free') {
                upgradeBtn.style.display = 'block';
                manageBtn.style.display = 'none';
                console.log('🔄 Updated buttons: showing upgrade, hiding manage');
            } else {
                upgradeBtn.style.display = 'none';
                manageBtn.style.display = 'block';
                console.log('🔄 Updated buttons: hiding upgrade, showing manage');
            }
        }
    }
    
    getPlanDisplayName(planType) {
        const planNames = {
            'free': 'Free Plan',
            'starter': 'Starter Plan',
            'professional': 'Professional Plan',
            'enterprise': 'Enterprise Plan'
        };
        return planNames[planType] || 'Free Plan';
    }
    
    getPlanLimits(planType) {
        const limits = {
            'free': '5 pages per day',
            'starter': '400 pages per month',
            'professional': '1000 pages per month',
            'enterprise': 'Unlimited pages'
        };
        return limits[planType] || '5 pages per day';
    }
    
    hidePricingForMembers() {
        console.log('🔄 hidePricingForMembers called');
        console.log('🔄 Current user:', this.currentUser);
        console.log('🔄 User subscription:', this.currentUser?.subscription);
        console.log('🔄 Plan type:', this.currentUser?.subscription?.planType);
        
        if (!this.currentUser || !this.currentUser.subscription || this.currentUser.subscription.planType === 'free') {
            console.log('🔄 Not hiding pricing - user is free or no subscription');
            return;
        }
        
        console.log('🔄 Hiding pricing for subscribed user');
        
        // Hide pricing section
        const pricingSection = document.getElementById('pricing');
        if (pricingSection) {
            pricingSection.style.display = 'none';
        }
        
        // Hide any plan-related content
        const planElements = document.querySelectorAll('[class*="plan"], [class*="pricing"], [id*="plan"], [id*="pricing"]');
        planElements.forEach(element => {
            if (element.id !== 'planName' && element.id !== 'planStatus' && element.id !== 'planLimits') {
                element.style.display = 'none';
            }
        });
        
        // Hide upgrade buttons in navigation or other areas
        const upgradeButtons = document.querySelectorAll('button[onclick*="upgrade"], button[onclick*="plan"], .upgrade-btn, .plan-btn');
        upgradeButtons.forEach(button => {
            button.style.display = 'none';
        });
    }
    
    showPricingForNonMembers() {
        const pricingSection = document.getElementById('pricing');
        if (pricingSection) {
            pricingSection.style.display = 'block';
        }
    }

    showFreePlan() {
        console.log('🔄 Showing free plan for non-authenticated user');
        
        const membershipCard = document.getElementById('membershipCard');
        const planName = document.getElementById('planName');
        const planStatus = document.getElementById('planStatus');
        const planLimits = document.getElementById('planLimits');
        const billingCycle = document.getElementById('billingCycle');
        const renewalDate = document.getElementById('renewalDate');
        const upgradeBtn = document.getElementById('upgradeBtn');
        const manageBtn = document.getElementById('manageBtn');
        
        if (!membershipCard) {
            console.log('🔄 No membershipCard found in showFreePlan');
            console.log('🔄 Available elements with "membership" in ID:', 
                Array.from(document.querySelectorAll('[id*="membership"]')).map(el => el.id));
            return;
        }
        
        // Ensure membership card is visible
        membershipCard.style.display = 'flex';
        membershipCard.style.visibility = 'visible';
        membershipCard.style.opacity = '1';
        console.log('🔄 Ensured membershipCard is visible in showFreePlan');
        
        // Set free plan styling
        membershipCard.className = 'membership-card free-plan';
        
        // Update plan details
        if (planName) planName.textContent = 'Free Plan';
        if (planStatus) planStatus.textContent = 'Active';
        if (planLimits) planLimits.textContent = '5 pages per day';
        if (billingCycle) billingCycle.textContent = 'No billing cycle';
        if (renewalDate) renewalDate.textContent = 'No renewal date';
        
        // Update action buttons
        if (upgradeBtn) upgradeBtn.style.display = 'block';
        if (manageBtn) manageBtn.style.display = 'none';
        
        console.log('✅ Free plan displayed');
    }
    
    upgradePlan() {
        // Scroll to pricing section or show upgrade modal
        const pricingSection = document.getElementById('pricing');
        if (pricingSection) {
            pricingSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    manageSubscription() {
        // Open subscription management (could be Stripe customer portal)
        this.showNotification('Subscription management coming soon!', 'info');
    }
    
    // Method to be called when profile page loads
    initializeProfilePage() {
        console.log('🔄 Initializing profile page');
        this.checkAuthStatus();
        // Load conversion history after auth check
        setTimeout(() => {
            this.loadConversionHistory();
        }, 500);
    }
    
    async saveSubscriptionToSupabase() {
        try {
            if (!this.currentUser || !this.currentUser.id) {
                console.error('No current user found');
                return;
            }
            
            const subscriptionData = {
                user_id: this.currentUser.id,
                plan_type: this.currentUser.subscription.planType || 'free',
                billing_cycle: this.currentUser.billingCycle || 'monthly',
                status: 'active',
                current_period_start: new Date().toISOString(),
                current_period_end: this.getNextBillingDate(),
                stripe_customer_id: this.currentUser.stripeCustomerId || null,
                stripe_subscription_id: this.currentUser.stripeSubscriptionId || null
            };
            
            console.log('📤 Sending subscription data to Supabase:', subscriptionData);
            
            const response = await fetch('/api/subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('userToken')}`
                },
                body: JSON.stringify(subscriptionData)
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('✅ Subscription saved to Supabase successfully:', result);
            } else {
                const errorData = await response.json();
                console.error('❌ Failed to save subscription to Supabase:', errorData);
            }
        } catch (error) {
            console.error('❌ Error saving subscription to Supabase:', error);
        }
    }
    
    getNextBillingDate() {
        const now = new Date();
        const billingCycle = this.currentUser.billingCycle || 'monthly';
        
        if (billingCycle === 'annual') {
            now.setFullYear(now.getFullYear() + 1);
        } else {
            now.setMonth(now.getMonth() + 1);
        }
        
        return now.toISOString();
    }

    logout() {
        // Clear stored auth data
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
        this.currentUser = null;
        
        // Redirect to home page
        window.location.href = '/';
    }

    async loadConversionHistory() {
        try {
            const userId = this.currentUser ? this.currentUser.id : '00000000-0000-0000-0000-000000000000';
            const response = await fetch(`/api/history?userId=${userId}`);
            const data = await response.json();
            
            if (data.success) {
                this.displayConversionHistory(data.history);
            } else {
                console.error('Failed to load conversion history:', data.message);
            }
        } catch (error) {
            console.error('Error loading conversion history:', error);
        }
    }

    displayConversionHistory(history) {
        const historySection = document.getElementById('historySection');
        const historyGrid = document.getElementById('historyGrid');
        const emptyHistory = document.getElementById('emptyHistory');
        const historyLoading = document.getElementById('historyLoading');
        
        // Hide loading state
        if (historyLoading) historyLoading.style.display = 'none';
        
        // Update profile stats
        this.updateProfileStats(history);
        
        if (history.length === 0) {
            // Show empty state
            if (emptyHistory) emptyHistory.style.display = 'block';
            if (historyGrid) historyGrid.innerHTML = '';
            if (historySection) historySection.style.display = 'none';
        } else {
            // Hide empty state
            if (emptyHistory) emptyHistory.style.display = 'none';
            
            if (historyGrid) {
                historyGrid.innerHTML = history.map(conv => `
                    <div class="history-item" style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                        <div class="history-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                            <h4 style="margin: 0; color: #374151; font-size: 1rem;">${conv.filename}</h4>
                            <span style="color: #6B7280; font-size: 0.875rem;">${new Date(conv.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div class="history-details" style="display: flex; gap: 1rem; margin-bottom: 1rem; font-size: 0.875rem; color: #6B7280;">
                            <span>📊 ${conv.transactionCount} transactions</span>
                            <span>📁 ${(conv.fileSize / 1024).toFixed(1)} KB</span>
                        </div>
                        <div class="history-actions" style="display: flex; gap: 0.5rem;">
                            <button onclick="app.viewConversion('${conv.id}')" class="btn-primary" style="padding: 0.5rem 1rem; background: #4F46E5; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem;">
                                View Details
                            </button>
                            <button onclick="app.downloadHistoryCSV('${conv.id}')" class="btn-secondary" style="padding: 0.5rem 1rem; background: #f3f4f6; color: #374151; border: 1px solid #d1d5db; border-radius: 4px; cursor: pointer; font-size: 0.875rem;">
                                Download CSV
                            </button>
                            <button onclick="app.deleteConversion('${conv.id}')" class="btn-danger" style="padding: 0.5rem 1rem; background: #EF4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem;">
                                Delete
                            </button>
                        </div>
                    </div>
                `).join('');
            }
            
            if (historySection) historySection.style.display = 'block';
        }
    }

    updateProfileStats(history) {
        const totalConversions = document.getElementById('totalConversions');
        const totalTransactions = document.getElementById('totalTransactions');
        const clearAllBtn = document.getElementById('clearAllBtn');
        
        if (totalConversions) {
            totalConversions.textContent = history.length;
        }
        
        if (totalTransactions) {
            const total = history.reduce((sum, conv) => sum + conv.transactionCount, 0);
            totalTransactions.textContent = total;
        }
        
        if (clearAllBtn) {
            clearAllBtn.style.display = history.length > 0 ? 'block' : 'none';
        }
    }

    async deleteConversion(conversionId) {
        if (!confirm('Are you sure you want to delete this conversion? This action cannot be undone.')) {
            return;
        }
        
        try {
            const userId = this.currentUser ? this.currentUser.id : '00000000-0000-0000-0000-000000000000';
            const response = await fetch(`/api/history/${conversionId}?userId=${userId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                this.showNotification('Conversion deleted successfully', 'success');
                this.loadConversionHistory(); // Refresh the history
            } else {
                this.showNotification('Failed to delete conversion: ' + data.message, 'error');
            }
        } catch (error) {
            console.error('Error deleting conversion:', error);
            this.showNotification('Error deleting conversion', 'error');
        }
    }

    async viewConversion(conversionId) {
        try {
            const userId = this.currentUser ? this.currentUser.id : '00000000-0000-0000-0000-000000000000';
            const response = await fetch(`/api/history/${conversionId}?userId=${userId}`);
            const data = await response.json();
            
            if (data.success) {
                // Display the conversion results
                this.displayResults([{
                    filename: data.conversion.filename,
                    csvData: data.conversion.csvData
                }]);
                
                // Hide history section
                const historySection = document.getElementById('historySection');
                if (historySection) {
                    historySection.style.display = 'none';
                }
            } else {
                console.error('Failed to load conversion details:', data.message);
            }
        } catch (error) {
            console.error('Error loading conversion details:', error);
        }
    }

    async downloadHistoryCSV(conversionId) {
        try {
            const userId = this.currentUser ? this.currentUser.id : '00000000-0000-0000-0000-000000000000';
            const response = await fetch(`/api/history/${conversionId}?userId=${userId}`);
            const data = await response.json();
            
            if (data.success) {
                // Create and download CSV
                const blob = new Blob([data.conversion.csvData], { type: 'text/csv' });
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = data.conversion.filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            } else {
                console.error('Failed to load conversion for download:', data.message);
            }
        } catch (error) {
            console.error('Error downloading conversion:', error);
        }
    }

    toggleHistory() {
        const historySection = document.getElementById('historySection');
        if (historySection) {
            historySection.style.display = historySection.style.display === 'none' ? 'block' : 'none';
        }
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

    showNotification(message, type = 'info', duration = 5000) {
        return this.uiUtils.showToast(message, type, duration);
    }


    showLoadingNotification(message, id = 'loading') {
        return this.uiUtils.showToast(`<span class="spinner"></span> ${message}`, 'info', 0);
    }

    hideLoadingNotification(id = 'loading') {
        // Toast notifications auto-remove, so this is simplified
        return;
    }

    async initializeStripe() {
        try {
            // Check if Stripe is available
            if (typeof Stripe === 'undefined') {
                console.log('⚠️ Stripe script not loaded yet, retrying in 1 second...');
                setTimeout(() => this.initializeStripe(), 1000);
                return;
            }
            
            // Get Stripe configuration
            const response = await fetch('/api/stripe-config');
            const config = await response.json();
            
            if (!config.isConfigured) {
                console.log('⚠️ Stripe not configured, payment features disabled');
                return;
            }
            
            // Initialize Stripe
            this.stripe = Stripe(config.publishableKey);
            console.log('✅ Stripe initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize Stripe:', error);
        }
    }

    async showPaymentModal(plan, billingCycle) {
        if (!this.stripe) {
            this.showNotification('Payment processing is not available', 'error');
            return;
        }

        try {
            // Update modal content
            this.updatePaymentModalContent(plan, billingCycle);
            
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
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to create payment intent');
            }

            const { clientSecret } = await response.json();
            this.currentPaymentIntent = clientSecret;

            // Create Stripe Elements
            this.elements = this.stripe.elements({
                clientSecret: clientSecret,
                appearance: {
                    theme: 'stripe',
                    variables: {
                        colorPrimary: '#4f46e5',
                        colorBackground: '#ffffff',
                        colorText: '#1e293b',
                        colorDanger: '#dc2626',
                        fontFamily: 'system-ui, sans-serif',
                        spacingUnit: '4px',
                        borderRadius: '6px',
                        colorTextSecondary: '#64748b',
                        colorBorder: '#e2e8f0',
                        colorBorderFocus: '#4f46e5'
                    },
                    rules: {
                        '.Input': {
                            border: '1px solid #e2e8f0',
                            borderRadius: '6px',
                            padding: '12px',
                            fontSize: '16px',
                            lineHeight: '1.5'
                        },
                        '.Input:focus': {
                            border: '1px solid #4f46e5',
                            boxShadow: '0 0 0 3px rgba(79, 70, 229, 0.1)'
                        },
                        '.Input--invalid': {
                            border: '1px solid #dc2626',
                            boxShadow: '0 0 0 3px rgba(220, 38, 38, 0.1)'
                        }
                    }
                }
            });

            // Create payment element
            this.paymentElement = this.elements.create('payment');
            this.paymentElement.mount('#payment-element');

            // Listen for real-time validation errors
            this.paymentElement.on('change', (event) => {
                const displayError = document.getElementById('payment-message');
                if (event.error) {
                    displayError.textContent = event.error.message;
                    displayError.className = 'payment-message error';
                    displayError.classList.remove('hidden');
                } else {
                    displayError.classList.add('hidden');
                }
            });

            // Set up payment form submission
            this.setupPaymentForm();

            // Show modal
            this.showModal('paymentModal');

        } catch (error) {
            console.error('Payment setup error:', error);
            this.showNotification(`Payment setup failed: ${error.message}`, 'error');
        }
    }

    updatePaymentModalContent(plan, billingCycle) {
        const planNames = {
            starter: 'Starter Plan',
            professional: 'Professional Plan',
            business: 'Business Plan'
        };

        const planDescriptions = {
            starter: '400 pages per month',
            professional: '1,000 pages per month',
            business: '4,000 pages per month'
        };

        const prices = {
            starter: { monthly: '$30/month', annual: '$180/year' },
            professional: { monthly: '$60/month', annual: '$360/year' },
            business: { monthly: '$99/month', annual: '$599/year' }
        };

        document.getElementById('selectedPlanName').textContent = planNames[plan];
        document.getElementById('selectedPlanPrice').textContent = prices[plan][billingCycle];
        document.getElementById('selectedPlanDescription').textContent = planDescriptions[plan];
    }

    setupPaymentForm() {
        const form = document.getElementById('submit-payment');
        const buttonText = document.getElementById('button-text');
        const spinner = document.getElementById('spinner');
        const paymentMessage = document.getElementById('payment-message');

        form.addEventListener('click', async (event) => {
            event.preventDefault();
            
            if (!this.stripe || !this.paymentElement) {
                this.showNotification('Payment system not ready', 'error');
                return;
            }

            // Show loading state
            form.disabled = true;
            buttonText.textContent = 'Processing...';
            spinner.classList.remove('hidden');
            paymentMessage.classList.add('hidden');

            try {
                const { error } = await this.stripe.confirmPayment({
                    elements: this.elements,
                    confirmParams: {
                        return_url: `${window.location.origin}/payment-success`,
                    },
                    redirect: 'if_required'
                });

                if (error) {
                    // Show error message
                    paymentMessage.textContent = error.message;
                    paymentMessage.className = 'payment-message error';
                    paymentMessage.classList.remove('hidden');
                } else {
                    // Payment succeeded
                    paymentMessage.textContent = 'Payment successful! Your subscription is now active.';
                    paymentMessage.className = 'payment-message success';
                    paymentMessage.classList.remove('hidden');
                    
                    // Update user subscription
                    const planType = this.getCurrentPlan();
                    const billingCycle = this.getCurrentBillingCycle();
                    
                    this.currentUser.subscription = {
                        planType: planType,
                        billingCycle: billingCycle,
                        status: 'active',
                        currentPeriodEnd: this.getNextBillingDate()
                    };
                    this.currentUser.billingCycle = billingCycle;
                    
                    // Update localStorage with new subscription data
                    localStorage.setItem('userData', JSON.stringify(this.currentUser));
                    console.log('✅ Updated user data in localStorage:', this.currentUser);
                    
                    // Save subscription to Supabase
                    await this.saveSubscriptionToSupabase();
                    
                    // Close modal and refresh page after delay
                    setTimeout(() => {
                        this.closeModal('paymentModal');
                        this.showNotification('🎉 Subscription activated successfully!', 'success');
                        // Refresh page to show updated membership details
                        setTimeout(() => {
                            window.location.reload();
                        }, 1500);
                    }, 2000);
                }

            } catch (error) {
                console.error('Payment confirmation error:', error);
                paymentMessage.textContent = 'An unexpected error occurred. Please try again.';
                paymentMessage.className = 'payment-message error';
                paymentMessage.classList.remove('hidden');
            } finally {
                // Reset button state
                form.disabled = false;
                buttonText.textContent = 'Subscribe Now';
                spinner.classList.add('hidden');
            }
        });
    }

    getCurrentPlan() {
        // This would be determined from the current payment intent or modal state
        // For now, we'll extract it from the modal content
        const planName = document.getElementById('selectedPlanName').textContent;
        const planMap = {
            'Starter Plan': 'starter',
            'Professional Plan': 'professional',
            'Business Plan': 'business'
        };
        return planMap[planName] || 'starter';
    }

    getCurrentBillingCycle() {
        // This would be determined from the current payment intent or modal state
        const price = document.getElementById('selectedPlanPrice').textContent;
        return price.includes('/year') ? 'annual' : 'monthly';
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            
            // Clean up Stripe Elements if it's the payment modal
            if (modalId === 'paymentModal' && this.paymentElement) {
                this.paymentElement.unmount();
                this.paymentElement = null;
                this.elements = null;
                this.currentPaymentIntent = null;
                
                // Reset payment form
                const paymentMessage = document.getElementById('payment-message');
                if (paymentMessage) {
                    paymentMessage.classList.add('hidden');
                    paymentMessage.textContent = '';
                }
            }
        }
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
    // Check if we're on the main page (has upload area) vs login/register pages vs profile page
    const isMainPage = document.getElementById('uploadArea') !== null;
    const isLoginPage = window.location.pathname.includes('/api/login');
    const isRegisterPage = window.location.pathname.includes('/api/register');
    const isProfilePage = window.location.pathname.includes('/profile.html');
    
    console.log('🚀 Page type:', { isMainPage, isLoginPage, isRegisterPage, isProfilePage });
    
    if (isMainPage || isProfilePage) {
        console.log('🚀 Main/Profile page detected, initializing SmartStatementConverter...');
        app = new SmartStatementConverter();
        
        if (isProfilePage) {
            console.log('🚀 Profile page detected, initializing profile...');
            app.initProfile();
        }
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

// Global function for table sorting
function sortTable(columnIndex, direction) {
    if (window.app) {
        window.app.sortTable(columnIndex, direction);
    }
}

// Profile page functionality
SmartStatementConverter.prototype.initProfile = function() {
    console.log('🔄 Initializing profile page...');
    console.log('🔄 Current user before checkAuthStatus:', this.currentUser);
    this.checkAuthStatus();
    console.log('🔄 Current user after checkAuthStatus:', this.currentUser);
    
    if (this.currentUser) {
        console.log('🔄 User authenticated, loading profile data...');
        this.loadProfileData();
        this.loadConversionHistory();
    } else {
        console.log('🔄 No user authenticated, redirecting to login...');
        // Show loading state while redirecting
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        if (profileName) profileName.textContent = 'Please login...';
        if (profileEmail) profileEmail.textContent = 'Redirecting to login page...';
        
        // Redirect to login after a short delay
        setTimeout(() => {
            window.location.href = '/api/login';
        }, 2000);
    }
};

SmartStatementConverter.prototype.loadProfileData = function() {
    if (!this.currentUser) return;
    
    // Update profile header
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profileAvatar = document.getElementById('profileAvatar');
    
    if (profileName) profileName.textContent = this.currentUser.name;
    if (profileEmail) profileEmail.textContent = this.currentUser.email;
    if (profileAvatar) {
        profileAvatar.innerHTML = `<div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 28px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3); border: 3px solid rgba(255, 255, 255, 0.2);">${this.currentUser.name.charAt(0).toUpperCase()}</div>`;
    }
    
    // Load subscription data from database
    this.loadSubscriptionFromDatabase();
};

SmartStatementConverter.prototype.loadSubscriptionFromDatabase = async function() {
    if (!this.currentUser || !this.currentUser.id) {
        console.log('🔄 No user ID available for loading subscription');
        return;
    }
    
    try {
        console.log('🔄 Loading subscription from database for user:', this.currentUser.id);
        const response = await fetch(`/api/subscription/${this.currentUser.id}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('userToken')}`
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.subscription) {
                console.log('✅ Subscription loaded from database:', data.subscription);
                
                // Update currentUser with database subscription data
                this.currentUser.subscription = {
                    planType: data.subscription.plan_type,
                    billingCycle: data.subscription.billing_cycle,
                    status: data.subscription.status,
                    currentPeriodEnd: data.subscription.current_period_end
                };
                
                // Update localStorage
                localStorage.setItem('userData', JSON.stringify(this.currentUser));
                
                // Update membership display
                this.updateMembershipDisplay();
                
                // Ensure membership card stays visible after database update
                setTimeout(() => {
                    const membershipCard = document.getElementById('membershipCard');
                    if (membershipCard) {
                        membershipCard.style.display = 'flex';
                        console.log('🔧 Ensured membership card visibility after database update');
                    }
                }, 100);
                
                console.log('✅ Updated user subscription from database:', this.currentUser.subscription);
            } else {
                console.log('🔄 No subscription found in database, using localStorage data');
                this.updateMembershipDisplay();
                
                // Ensure membership card stays visible
                setTimeout(() => {
                    const membershipCard = document.getElementById('membershipCard');
                    if (membershipCard) {
                        membershipCard.style.display = 'flex';
                        console.log('🔧 Ensured membership card visibility after no subscription found');
                    }
                }, 100);
            }
        } else {
            console.log('🔄 Failed to load subscription from database, using localStorage data');
            this.updateMembershipDisplay();
            
            // Ensure membership card stays visible
            setTimeout(() => {
                const membershipCard = document.getElementById('membershipCard');
                if (membershipCard) {
                    membershipCard.style.display = 'flex';
                    console.log('🔧 Ensured membership card visibility after database error');
                }
            }, 100);
        }
    } catch (error) {
        console.error('❌ Error loading subscription from database:', error);
        // Fallback to localStorage data
        this.updateMembershipDisplay();
        
        // Ensure membership card stays visible
        setTimeout(() => {
            const membershipCard = document.getElementById('membershipCard');
            if (membershipCard) {
                membershipCard.style.display = 'flex';
                console.log('🔧 Ensured membership card visibility after error');
            }
        }, 100);
    }
};

SmartStatementConverter.prototype.refreshHistory = function() {
    console.log('🔄 Refreshing conversion history...');
    this.loadConversionHistory();
};

SmartStatementConverter.prototype.clearAllHistory = function() {
    if (!this.currentUser) return;
    
    if (confirm('Are you sure you want to delete all your conversion history? This action cannot be undone.')) {
        console.log('🔄 Clearing all conversion history...');
        // This would need to be implemented as a bulk delete API endpoint
        alert('Bulk delete functionality will be implemented in the next update.');
    }
};