# Domain-to-Company Name Extractor

## Overview
A production-scale domain intelligence platform transforming web domains into precise legal entity insights through advanced web scraping and intelligent business classification. It provides real-time processing updates, comprehensive business intelligence categorization, and actionable acquisition research guidance. The project aims to deliver highly accurate, verified legal entity information for market analysis and strategic decision-making.

## User Preferences
- Professional interface without excessive technical jargon
- Clear feedback on upload success/failure status
- Real-time updates for processing progress
- Focus on proper legal entity names: for-profit companies have suffixes (Inc., Corp., LLC, Ltd.) while institutions don't
- Quality over quantity: Prefer accurate legal entity names over inflated success rates from garbage extractions
- Actionable business intelligence: Clear categorization for acquisition research (Good Target vs Skip vs Manual Review)
- Independent validation approach: Perform comprehensive analysis to identify and fix parsing quality issues
- Performance optimization priority: Early triage to save processing time on problematic domains

## System Architecture
The platform is built with a React frontend and an Express backend, both utilizing TypeScript. A federated microservice-like architecture is employed for collection methods, ensuring independence and scalability.

- **Frontend**: React with TypeScript, TanStack Query for data management, Wouter for routing, Material Design principles, Tailwind CSS, and shadcn/ui components for a clean, professional UI.
- **Backend**: Express server with TypeScript, designed for robust API handling and processing orchestration.
- **Storage**: PostgreSQL for persistent storage, enabling cross-batch intelligence, duplicate detection, and permanent session results. In-memory storage (MemStorage) is used for development.
- **Processing**: Features a batch processor with a sophisticated web scraping service. It includes a two-stage cleaning pipeline (HTML stripping followed by LLM enhancement).
- **Core Logic**:
    - **Business Intelligence Classification**: Categorizes domains into actionable categories like "Good Target - Tech Issue," "Bad Website - Skip," and "Protected - Manual Review."
    - **Enhanced Domain Processing**: Includes Fortune 500 company mappings with high confidence and strict legal entity validation, enforcing corporate suffixes.
    - **Quality-Focused Extraction**: Disables problematic footer extraction and uses country-aware pattern matching.
    - **International Legal Entity Recognition**: Supports comprehensive corporate structure validation across 14 jurisdictions.
    - **Real-time Processing Updates**: Live status tracking with 5-second refresh intervals and processing time metrics.
    - **Federated Architecture**: Utilizes separate services (e.g., Playwright Dump, Scrapy Crawl, Crawlee Dump, Axios+Cheerio) for data collection, designed for maximum flexibility and independent operation, enabling mix-and-match combinations of collection methods and LLM models. Includes documented conventions for voluntary consistency across services while maintaining complete independence.
    - **LLM Cleaning Pipeline**: Integrates free DeepSeek models for cleaning and enhancing crawled page data, with a designed two-stage pipeline for efficient processing.
    - **OpenRouter Integration**: Implements a comprehensive model control system for flexible LLM selection, supporting various strategies (cost-optimized, priority-based, consensus) and specific use cases.
    - **Data Collection**: Comprehensive raw data capture includes HTML content, screenshots, text extraction, meta tags, links, and structured data for LLM analysis.
    - **Error Handling**: Robust server restart protection, intelligent port conflict resolution, and automatic cleanup of beta server instances.
    - **Data Management**: Implements unique domain hash IDs for persistent identification and duplicate prevention, alongside comprehensive CSV/JSON export capabilities with detailed analytics.
    - **GLEIF Integration (Beta V2)**: Implements phased GLEIF search service within Beta V2 federation. Phase 1 (Complete): Direct GLEIF API search with algorithmic scoring. Phase 2 (Planned): Analysis of outputs and patterns. Phase 3 (Planned): LLM arbitration for confident domain-to-company matching using geographic markers and headquarters data.
    - **Machine-Friendly Configuration**: Centralizes extraction methods, confidence modifiers, validation rules, and jurisdiction data in TypeScript configurations for dynamic updates.
    - **Performance Optimization**: Early connectivity triage saves processing time on unreachable domains. Multi-layer timeout systems prevent processing stalls.
    - **Extraction Hierarchy**: Utilizes structured data (JSON-LD), enhanced meta properties, footer copyright, logo alt text, H1 analysis, and page title for extraction, with a focus on legal entity names.

## External Dependencies
- **React**: Frontend library.
- **Express.js**: Backend web framework.
- **Multer**: For file uploads in Express.
- **Axios**: For HTTP requests.
- **Cheerio**: For HTML parsing.
- **TanStack Query**: For asynchronous state management.
- **Tailwind CSS**: For styling.
- **shadcn/ui**: UI component library.
- **PostgreSQL**: Database for persistent storage.
- **UV**: Python dependency manager.
- **OpenRouter**: For LLM API access and model management (e.g., DeepSeek Chat, Meta Llama models).
- **Crawlee**: Web scraping library for data collection.
- **Playwright**: Browser automation library for data collection.
- **Scrapy (Python)**: Web crawling framework for data collection.
- **BeautifulSoup (Python)**: For HTML parsing in Python scripts.
- **Global LEI Foundation (GLEIF) API**: For legal entity verification and enrichment.