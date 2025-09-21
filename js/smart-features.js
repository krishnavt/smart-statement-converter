// Smart Features - Bank detection, export options, auto-save
class SmartFeatures {
    constructor() {
        this.bankPatterns = {
            'Chase': /chase|jpmorgan|j\.p\.\s*morgan|chase\s+bank/i,
            'Bank of America': /bank\s+of\s+america|bofa|b\.o\.a|bank\s+of\s+america\s+corp/i,
            'Wells Fargo': /wells\s+fargo|wells\s+fargo\s+bank/i,
            'Citi': /citibank|citi|citigroup/i,
            'US Bank': /us\s+bank|usbank|u\.s\.\s+bank/i,
            'PNC': /pnc\s+bank|pnc\s+financial/i,
            'Capital One': /capital\s+one|capital\s+one\s+bank/i,
            'TD Bank': /td\s+bank|toronto\s+dominion|td\s+ameritrade/i,
            'HSBC': /hsbc|hsbc\s+bank/i,
            'American Express': /american\s+express|amex|american\s+express\s+bank/i,
            'Discover': /discover|discover\s+bank|discover\s+financial/i,
            'Ally Bank': /ally\s+bank|ally\s+financial/i,
            'Charles Schwab': /charles\s+schwab|schwab|schwab\s+bank/i,
            'Fidelity': /fidelity|fidelity\s+bank|fidelity\s+investments/i,
            'Vanguard': /vanguard|vanguard\s+bank/i,
            'Goldman Sachs': /goldman\s+sachs|goldman\s+sachs\s+bank/i,
            'Morgan Stanley': /morgan\s+stanley|morgan\s+stanley\s+bank/i,
            'JP Morgan': /jp\s+morgan|j\.p\.\s+morgan\s+chase/i,
            'Bank of New York': /bank\s+of\s+new\s+york|bny\s+mellon/i,
            'State Street': /state\s+street|state\s+street\s+bank/i
        };

        this.exportFormats = {
            csv: { name: 'CSV', mime: 'text/csv', extension: '.csv' },
            excel: { name: 'Excel', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', extension: '.xlsx' },
            json: { name: 'JSON', mime: 'application/json', extension: '.json' },
            xml: { name: 'XML', mime: 'application/xml', extension: '.xml' }
        };

        this.init();
    }

    init() {
        this.setupAutoSave();
        this.setupExportOptions();
    }

    // Bank Detection
    detectBank(text) {
        if (!text || typeof text !== 'string') {
            return { bank: 'Unknown', confidence: 0 };
        }

        let bestMatch = { bank: 'Unknown', confidence: 0 };
        
        for (const [bankName, pattern] of Object.entries(this.bankPatterns)) {
            const matches = text.match(pattern);
            if (matches) {
                const confidence = matches.length / text.length * 100;
                if (confidence > bestMatch.confidence) {
                    bestMatch = { bank: bankName, confidence: Math.min(confidence, 100) };
                }
            }
        }

        return bestMatch;
    }

    // Enhanced PDF parsing with bank detection
    parseBankStatement(text, filename = '') {
        const bankInfo = this.detectBank(text);
        const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
        
        // Try to extract account information
        const accountInfo = this.extractAccountInfo(text);
        
        // Parse transactions
        const transactions = this.parseTransactions(lines);
        
        return {
            bank: bankInfo.bank,
            confidence: bankInfo.confidence,
            accountInfo,
            transactions,
            metadata: {
                filename,
                parsedAt: new Date().toISOString(),
                totalLines: lines.length,
                totalTransactions: transactions.length
            }
        };
    }

    extractAccountInfo(text) {
        const patterns = {
            accountNumber: /account\s*(?:number|#)?\s*:?\s*(\d{4,})/i,
            routingNumber: /routing\s*(?:number|#)?\s*:?\s*(\d{9})/i,
            statementDate: /statement\s*date\s*:?\s*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
            balance: /(?:balance|total)\s*:?\s*\$?([\d,]+\.?\d*)/i
        };

        const info = {};
        for (const [key, pattern] of Object.entries(patterns)) {
            const match = text.match(pattern);
            if (match) {
                info[key] = match[1];
            }
        }

        return info;
    }

    parseTransactions(lines) {
        const transactions = [];
        const transactionPatterns = [
            // Enhanced patterns for better matching
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([+-]?\$?[\d,]+\.?\d{2})\s+([+-]?\$?[\d,]+\.?\d{2})/, // Date, Desc, Amount, Balance
            /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+?)\s+([+-]?\$?[\d,]+\.?\d{2})/, // Date, Description, Amount
            /([+-]?\$?[\d,]+\.?\d{2})\s+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(.+)/, // Amount, Date, Description
            /(.+?)\s+([+-]?\$?[\d,]+\.?\d{2})\s+([+-]?\$?[\d,]+\.?\d{2})$/, // Description, Amount, Balance
            /(.+?)\s+([+-]?\$?[\d,]+\.?\d{2})$/, // Description, Amount
            // Credit card patterns
            /(\d{1,2}\/\d{1,2})\s+(.+?)\s+([+-]?\$?[\d,]+\.?\d{2})/, // MM/DD, Description, Amount
            // Bank statement patterns
            /(\w{3}\s+\d{1,2},?\s+\d{4})\s+(.+?)\s+([+-]?\$?[\d,]+\.?\d{2})/, // Aug 31, 2025, Description, Amount
        ];

        for (const line of lines) {
            // Skip empty lines and headers
            if (!line.trim() || this.isHeaderLine(line)) continue;
            
            for (const pattern of transactionPatterns) {
                const match = line.match(pattern);
                if (match) {
                    const transaction = this.parseTransactionMatch(match, pattern);
                    if (transaction && this.isValidTransaction(transaction)) {
                        transactions.push(transaction);
                        break;
                    }
                }
            }
        }

        return this.deduplicateTransactions(transactions);
    }

    isHeaderLine(line) {
        const headers = ['date', 'description', 'amount', 'balance', 'type', 'transaction'];
        const lowerLine = line.toLowerCase();
        return headers.some(header => lowerLine.includes(header));
    }

    isValidTransaction(transaction) {
        // Validate transaction has required fields
        if (!transaction.date || !transaction.amount) return false;
        
        // Validate amount is a number
        const amount = parseFloat(transaction.amount.replace(/[$,]/g, ''));
        if (isNaN(amount)) return false;
        
        // Validate date format
        if (!this.isValidDate(transaction.date)) return false;
        
        return true;
    }

    isValidDate(dateStr) {
        // Check various date formats
        const datePatterns = [
            /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/, // MM/DD/YYYY
            /^\w{3}\s+\d{1,2},?\s+\d{4}$/, // Aug 31, 2025
            /^\d{1,2}\s+\w{3}\s+\d{4}$/ // 31 Aug 2025
        ];
        
        return datePatterns.some(pattern => pattern.test(dateStr));
    }

    deduplicateTransactions(transactions) {
        const seen = new Set();
        return transactions.filter(transaction => {
            const key = `${transaction.date}-${transaction.description}-${transaction.amount}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    parseTransactionMatch(match, pattern) {
        try {
            // This is a simplified parser - in reality, you'd need more sophisticated logic
            const groups = match.slice(1);
            
            if (groups.length >= 3) {
                return {
                    date: groups[0],
                    description: groups[1],
                    amount: groups[2].replace(/[$,]/g, ''),
                    type: groups[2].startsWith('-') ? 'debit' : 'credit'
                };
            }
        } catch (error) {
            console.error('Error parsing transaction:', error);
        }
        return null;
    }

    // Export Options
    setupExportOptions() {
        // This will be called when export options are needed
    }

    exportData(data, format = 'csv', filename = 'statement') {
        const exportInfo = this.exportFormats[format];
        if (!exportInfo) {
            throw new Error(`Unsupported export format: ${format}`);
        }

        switch (format) {
            case 'csv':
                return this.exportToCSV(data, filename);
            case 'excel':
                return this.exportToExcel(data, filename);
            case 'json':
                return this.exportToJSON(data, filename);
            case 'xml':
                return this.exportToXML(data, filename);
            default:
                throw new Error(`Export format not implemented: ${format}`);
        }
    }

    exportToCSV(data, filename) {
        if (data.transactions && Array.isArray(data.transactions)) {
            const headers = ['Date', 'Description', 'Amount', 'Type'];
            const csvContent = [
                headers.join(','),
                ...data.transactions.map(t => [
                    t.date || '',
                    `"${(t.description || '').replace(/"/g, '""')}"`,
                    t.amount || '',
                    t.type || ''
                ].join(','))
            ].join('\n');

            return this.downloadFile(csvContent, `${filename}.csv`, 'text/csv');
        }
        return false;
    }

    exportToJSON(data, filename) {
        const jsonContent = JSON.stringify(data, null, 2);
        return this.downloadFile(jsonContent, `${filename}.json`, 'application/json');
    }

    exportToXML(data, filename) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<statement>\n';
        xml += `  <bank>${data.bank || 'Unknown'}</bank>\n`;
        xml += `  <confidence>${data.confidence || 0}</confidence>\n`;
        
        if (data.accountInfo) {
            xml += '  <account>\n';
            for (const [key, value] of Object.entries(data.accountInfo)) {
                xml += `    <${key}>${value}</${key}>\n`;
            }
            xml += '  </account>\n';
        }

        if (data.transactions) {
            xml += '  <transactions>\n';
            data.transactions.forEach(t => {
                xml += '    <transaction>\n';
                xml += `      <date>${t.date || ''}</date>\n`;
                xml += `      <description>${t.description || ''}</description>\n`;
                xml += `      <amount>${t.amount || ''}</amount>\n`;
                xml += `      <type>${t.type || ''}</type>\n`;
                xml += '    </transaction>\n';
            });
            xml += '  </transactions>\n';
        }
        
        xml += '</statement>';
        return this.downloadFile(xml, `${filename}.xml`, 'application/xml');
    }

    exportToExcel(data, filename) {
        // For Excel export, we'll use a simple CSV format that Excel can open
        // In a real implementation, you'd use a library like SheetJS
        return this.exportToCSV(data, filename.replace('.xlsx', ''));
    }

    downloadFile(content, filename, mimeType) {
        try {
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            return true;
        } catch (error) {
            console.error('Error downloading file:', error);
            return false;
        }
    }

    // Auto-save functionality
    setupAutoSave() {
        // Auto-save every 30 seconds
        setInterval(() => {
            this.autoSave();
        }, 30000);

        // Auto-save before page unload
        window.addEventListener('beforeunload', () => {
            this.autoSave();
        });
    }

    autoSave() {
        try {
            const currentData = this.getCurrentData();
            if (currentData) {
                localStorage.setItem('smart_converter_autosave', JSON.stringify({
                    data: currentData,
                    timestamp: Date.now()
                }));
                console.log('Auto-save completed');
            }
        } catch (error) {
            console.error('Auto-save error:', error);
        }
    }

    getCurrentData() {
        // Get current form data, uploaded files, etc.
        const fileInput = document.getElementById('fileInput');
        const uploadedFiles = [];
        
        if (fileInput && fileInput.files) {
            for (let i = 0; i < fileInput.files.length; i++) {
                const file = fileInput.files[i];
                uploadedFiles.push({
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                });
            }
        }

        return {
            uploadedFiles,
            timestamp: Date.now()
        };
    }

    restoreAutoSave() {
        try {
            const saved = localStorage.getItem('smart_converter_autosave');
            if (saved) {
                const data = JSON.parse(saved);
                const age = Date.now() - data.timestamp;
                
                // Only restore if less than 1 hour old
                if (age < 3600000) {
                    console.log('Restoring auto-saved data');
                    return data.data;
                } else {
                    // Clean up old auto-save data
                    localStorage.removeItem('smart_converter_autosave');
                }
            }
        } catch (error) {
            console.error('Error restoring auto-save:', error);
        }
        return null;
    }

    // Utility methods
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    formatDate(date) {
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }).format(new Date(date));
    }

    validateBankStatement(data) {
        const errors = [];
        
        if (!data.bank || data.bank === 'Unknown') {
            errors.push('Could not identify bank');
        }
        
        if (!data.transactions || data.transactions.length === 0) {
            errors.push('No transactions found');
        }
        
        if (data.confidence < 50) {
            errors.push('Low confidence in bank detection');
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }
}

// Export for use in other scripts
window.SmartFeatures = SmartFeatures;