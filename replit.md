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
- Fixed FormData handling in apiRequest function for file uploads
- Successfully tested upload and processing workflow (June 24, 2025)
- Confirmed real-time processing updates and company name extraction
- Fixed results table query function to properly display extraction results
- Removed debugging console logs for cleaner production code
- Enhanced company name extraction with proper legal entity names (June 24, 2025)
- Added known company mappings for accurate Fortune 500 entity names
- Improved extraction patterns to filter out error messages and generic content
- Implemented for-profit vs institutional entity distinction per user guidance
- Added confidence scoring based on legal suffixes and institutional patterns
- Added intelligent duplicate domain handling with high-confidence result caching
- System now reuses existing results with 85%+ confidence to avoid redundant processing

## User Preferences
- Professional interface without excessive technical jargon
- Clear feedback on upload success/failure status
- Real-time updates for processing progress
- Focus on proper legal entity names: for-profit companies have suffixes (Inc., Corp., LLC, Ltd.) while institutions don't

## Technical Stack
- React 18 with TypeScript
- Express.js with Multer for file uploads
- Axios for HTTP requests and Cheerio for HTML parsing
- TanStack Query for state management
- Tailwind CSS with custom Material Design styling