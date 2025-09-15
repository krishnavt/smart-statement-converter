# Smart Statement Converter

A web application that converts PDF bank statements from thousands of banks worldwide into clean CSV/Excel format. Built with a focus on privacy, security, and ease of use.

## Features

- **Secure PDF Processing**: Upload and convert bank statement PDFs to structured CSV data
- **Multi-tier Pricing**: Anonymous, registered, and premium subscription options
- **Privacy-First**: Files are automatically deleted after 24 hours
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **User Authentication**: Secure login/registration system
- **Usage Tracking**: Built-in limits and subscription management

## Demo

The application provides:
- Anonymous conversions (1 page/24 hours)
- Registered user conversions (5 pages/24 hours)
- Premium subscriptions (400-4000+ pages/month)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd smart-statement-converter
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:8080`

## Usage

### For Users
1. Visit the homepage
2. Upload a PDF bank statement (max 10MB)
3. Wait for processing (typically 2-5 seconds)
4. Download the converted CSV file

### For Developers

The application structure:
```
├── index.html          # Main application page
├── styles.css          # All styling and responsive design
├── script.js           # Frontend JavaScript logic
├── privacy.html        # Privacy policy page
├── terms.html          # Terms and conditions
├── package.json        # Dependencies and scripts
└── README.md          # This file
```

## Technical Implementation

### Frontend
- **Vanilla JavaScript**: No frameworks, lightweight and fast
- **Responsive CSS**: Mobile-first design with CSS Grid and Flexbox
- **Modern Web APIs**: File API, Drag & Drop, Local Storage

### File Processing
The current implementation includes:
- PDF file validation and size checking
- Mock CSV generation (for demonstration)
- Download functionality for converted files

### For Production Implementation
To make this production-ready, you would need to:

1. **PDF Processing Backend**: 
   - Use libraries like `pdf2pic`, `tesseract.js` for OCR
   - Implement bank statement parsing algorithms
   - Set up secure file handling

2. **Database Integration**:
   - User management and authentication
   - Usage tracking and billing
   - File processing logs

3. **Payment Processing**:
   - Stripe integration for subscriptions
   - Webhook handling for payment events

4. **Security Enhancements**:
   - File encryption during processing
   - Rate limiting and DDoS protection
   - Secure file deletion

## Privacy & Security

- Files are processed locally in the browser where possible
- Uploaded files are automatically deleted after 24 hours
- No third-party data sharing
- GDPR and CCPA compliant privacy policy

## Pricing Tiers

- **Anonymous**: 1 page per 24 hours (Free)
- **Registered**: 5 pages per 24 hours (Free)
- **Starter**: 400 pages/month ($30/month)
- **Professional**: 1000 pages/month ($60/month)
- **Business**: 4000 pages/month ($99/month)
- **Enterprise**: Custom solutions

## Development

### Scripts
- `npm run dev`: Start development server
- `npm run build`: Build for production
- `npm start`: Start with Vercel dev

### Browser Support
- Modern browsers (Chrome 70+, Firefox 65+, Safari 12+)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

Copyright © 2025 Smart Statement Converter Ltd.

## Contact

- Email: support@smartstatementconverter.net
- Website: smartstatementconverter.net