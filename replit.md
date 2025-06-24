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
- Implemented stricter confidence thresholds to prioritize domain mappings over HTML extraction
- Enhanced filtering to completely reject marketing taglines and descriptive content
- Configured system to ALWAYS use domain mappings as authoritative source for known companies
- Fixed extraction priority to prefer legal entity names over marketing content
- Added comprehensive session results feature for QC and feedback tracking
- Session results include success/failure metrics, confidence breakdowns, and processing analytics
- Restructured processing options to prioritize domain mapping as primary method (not fallback)
- Domain mapping now always enabled with 95% confidence, HTML extraction as backup only
- Migrated from in-memory storage to PostgreSQL for data persistence and production readiness
- Database provides duplicate detection, cross-batch intelligence, and permanent session results
- Added comprehensive Analytics Dashboard with time-based performance tracking
- Multi-metric visualization showing confidence trends, success rates, processing efficiency, and extraction method usage
- Enhanced Chinese company domain mappings with proper Fortune 500 entities and state-owned enterprises
- Fixed confidence scoring for known global companies (95% for domain mapping vs 55% for generic parsing)
- Added comprehensive Chinese corporate structure recognition (Co. Ltd., Group Ltd., etc.)

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