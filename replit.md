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
- Refactored Analytics Dashboard for faster performance and real-time updates
- Simplified interface with key metrics, batch history, and summary statistics
- Increased refresh rate to 5 seconds with manual refresh capability for immediate updates
- Added per-domain processing time tracking with millisecond precision in database schema
- Enhanced analytics to show actual processing times instead of estimated batch averages
- Results table now displays individual domain processing times (ms/s format)
- Added cumulative performance tracking comparing latest run vs historical averages
- Dashboard now shows over/under performance indicators for confidence, success rate, domain mapping, and processing time
- Enhanced file upload debugging with comprehensive parsing and deduplication logging
- Fixed domain validation for international TLDs and improved duplicate detection
- Upload now shows exact counts: total parsed, unique domains, duplicates removed
- Enhanced Chinese company domain mappings with proper Fortune 500 entities and state-owned enterprises
- Fixed confidence scoring for known global companies (95% for domain mapping vs 55% for generic parsing)
- Added comprehensive Chinese corporate structure recognition (Co. Ltd., Group Ltd., etc.)
- Fixed Session Stats component to properly display session results including duplicate detection metrics
- Session Stats now shows comprehensive failure analysis confirming Chinese company web scraping resistance
- Auto-batch selection ensures most recent processing results are always visible in UI
- Session Stats now automatically populates with latest session data without requiring manual batch selection
- Enhanced Session Stats flow to show most recent session by default with fallback to specific batch selection
- Fixed Session Stats empty display issue by optimizing session results API query performance
- Fixed Analytics Dashboard outdated data by correcting batch completion timestamp recording
- Updated analytics to use actual completion times instead of synthetic timestamps
- Enhanced HTML extraction to scrape About Us and Terms pages for better company name detection
- Added intelligent sub-page crawling for /about, /company, /terms paths where legal entity names appear
- Created comprehensive Parsing Rules documentation page for developers
- Documented extraction methods, confidence scoring, pattern recognition, and validation rules
- Added comprehensive Jurisdictional Knowledge Reference with detailed legal entity explanations across 9 jurisdictions
- Included capital requirements, regulatory details, and validation algorithms with minimal visual elements
- Implemented early triage connectivity check for performance optimization (saves 7+ seconds per unreachable domain)
- All unreachable domains properly count as failures - bad websites are legitimately unusable for business purposes
- Enhanced error classification provides diagnostic clarity while maintaining accurate success rate metrics
- Fixed processor to use enhanced DomainExtractor with About Us/Terms page crawling (June 24, 2025)
- About Us and Terms page crawling now active for improved legal entity name extraction
- Emergency fix: Restored proper validation logic to prevent extraction of marketing taglines and generic content
- Enhanced invalid pattern detection to reject "Our business is", "Client Challenge", "Grocery Store", etc.
- Added German company domain mappings to fix current bad extractions (Springer, RTL, Wirecard, etc.)
- Implemented dual-layer validation with marketing content detection to completely block descriptive phrases
- Enhanced German legal entity recognition: GmbH, AG, UG, KG, SE, Stiftung, e.V., etc. (June 24, 2025)
- Added 37+ German company mappings with proper legal entity names and suffixes
- Fixed major German retailer/media failures: REWE Group, Bertelsmann SE & Co. KGaA, ALDI Group, ProSiebenSat.1 Media SE
- CRITICAL FIX: Domain mappings now override cached results to prevent bad extractions from persisting
- Updated database to correct all cached German company names to proper legal entity names
- HTML title extraction identified as unreliable source - heavily penalized and deprioritized (June 24, 2025)
- **COMPLETE REMOVAL**: HTML title extraction eliminated entirely due to marketing content contamination
- Added comprehensive Indian company mappings with proper legal entity names (Ltd, Pvt Ltd, etc.)
- Added French legal entity recognition: SARL, SA, SAS, SNC, SCS, SCA, EURL, SC, SCOP, GIE, SEM, Fondation
- Added Mexican legal entity recognition: S.A., S.A. de C.V., S. de R.L., S. de R.L. de C.V., S.C., A.C., I.A.P., S.A.P.I.
- Enhanced US legal entity recognition: Added professional entities (P.C., PLLC), partnerships (LP, LLP, LLLP), cooperatives, trusts
- Added Canadian legal entity recognition: Inc., Ltd., Corp., P.C., LP, LLP, Co-op, Trust, Ltée (Quebec French variants)
- Added Brazilian legal entity recognition: Ltda., S.A., SLU, EIRELI, MEI, Cooperativa, Fundação, Associação
- Added Irish legal entity recognition: Ltd, DAC, PLC, CLG, UC, ULC, LP, Society, Trust (comprehensive Companies Act 2014 compliance)
- Added Italian legal entity recognition: S.p.A., S.r.l., S.r.l.s., S.n.c., S.a.s., S.a.p.a., Soc. Coop., Fondazione (Italian Civil Code compliance)
- CRITICAL FIX: Implemented global penalty system for missing legal suffixes (-25% confidence penalty)
- Added 55+ French company domain mappings with proper legal entity names (SA, SE suffixes)
- Fixed all false positives: Credit Agricole → Crédit Agricole SA, Saint-Gobain SA, etc.
- Global principle: Absence of legal suffix indicates either extraction error or nonprofit status
- Final extraction priority: Domain mappings → About Us pages → Legal pages → Domain parsing (fallback)

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