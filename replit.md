# Domain-to-Company Name Extractor

## Project Overview
A production-scale web application for extracting company names from domain lists using web scraping and batch processing. Built with React frontend and Express backend, featuring real-time processing updates and comprehensive result management.

## Architecture
- **Frontend**: React with TypeScript, TanStack Query, Wouter routing
- **Backend**: Express server with TypeScript
- **Storage**: In-memory storage (MemStorage) for development
- **Processing**: Batch processor with web scraping service
- **UI**: Material Design with Tailwind CSS and shadcn/ui components

## Key Features
- Bulk domain file upload (CSV/TXT)
- Multi-method extraction (HTML title, meta description, domain parsing)
- Real-time processing status updates
- Results table with filtering and search
- Export functionality (CSV/JSON)
- Activity feed for system events
- Processing statistics dashboard

## Recent Changes
- Fixed upload route function reference bug (parseDomainFile/domainsToCSV)
- Enhanced error handling in file upload component
- Added automatic processing start after successful upload
- Improved user feedback with toast notifications
- Created sample domain file for testing

## User Preferences
- Professional interface without excessive technical jargon
- Clear feedback on upload success/failure status
- Real-time updates for processing progress

## Technical Stack
- React 18 with TypeScript
- Express.js with Multer for file uploads
- Axios for HTTP requests and Cheerio for HTML parsing
- TanStack Query for state management
- Tailwind CSS with custom Material Design styling