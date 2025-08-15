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
- **Domain-to-Entity Mapping Philosophy**: Embrace 1-to-many mappings (1x4 or 1x5 entities per domain). Present multiple entity claims with evidence, let LLM arbitrator apply user bias. Truth is a range of entities with confidence scores, not a single answer. For larger companies, multiple valid entities exist (e.g., QIAGEN GmbH as operator AND QIAGEN N.V. as holding company are both correct)
- **LEI Verification Requirement**: Claims without LEI codes are not useful - only show verified entities with LEI codes in claims output (Aug 9, 2025)

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
    - **Data Processing Stage 2 Pipeline (Complete as of Aug 1, 2025)**: Fully operational 4-stage processing pipeline that transforms raw web scraping dumps into verified legal entities. Stage 1: HTML stripping. Stage 2: Data extraction with LLM enhancement. Stage 3: Entity name extraction with confidence scoring. Stage 4: GLEIF verification. Pipeline processes dumps from all collection methods (Playwright, Scrapy, Crawlee, Axios+Cheerio) with comprehensive error handling and real-time status updates.
    - **Fast Entity Extraction Optimization (Complete as of Aug 13, 2025)**: Achieved 7-10x performance improvement (1.2s vs 8-11s) in dump-to-cleaning phase through TypeScript-based fast entity extractor that bypasses slow LLM calls. Extractor directly parses structured data (JSON-LD), meta tags, and HTML elements with intelligent pattern matching. Properly handles LocalBusiness, Organization, and brand schemas with automatic suffix inference (e.g., adding "Inc." to business names). Maintains high accuracy (90% confidence) while dramatically improving speed. Successfully extracts entities like "1800Heaters Inc." with proper suffixes. User preference: "accuracy over speed is anyday more important for me" and "not worried about speed yet at all" - system prioritizes correct entity extraction from structured data sources.
    - **Database Large Payload Fix (Complete as of Aug 13, 2025)**: Fixed PostgreSQL JSONB casting issue that prevented large crawl data (1-2MB+) from being saved. Solution uses direct Neon driver with sql template literals (`betaV2Db.execute(sql`...`)`) instead of problematic `executeBetaV2Query` function that does manual parameter replacement. Successfully saves 1.89MB dump_data for fnp.com. Also fixed LLM model issue by switching from hanging DeepSeek model to working Mixtral model (7.6s vs 217s processing time).
    - **Enhanced Metadata Preservation for Bias Handling (Complete as of Aug 11, 2025)**: Comprehensive metadata collection and preservation system for bias-aware entity extraction. MetadataExtractor captures domain language (HTTP headers, meta tags, content analysis), server/business location (HTTP headers, geolocation, legal addresses), and currency patterns (symbols, codes, pricing) with confidence scoring. Metadata flows through entire pipeline: crawling → cleaning → LLM processing. Creates enhanced system prompts with regional context for LLMs to adjust extraction based on jurisdiction norms, language variations, and regional disclosure patterns. Addresses extraction bias where Japanese/Asian sites have less prominent entity display while US sites have clearer disclosure.
    - **GLEIF Claims Pipeline (Updated Aug 9, 2025)**: Enhanced claims-based approach for entity extraction that treats all GLEIF outputs as claims rather than definitive answers. Generates multiple entity suspects with wildcards (e.g., "Evotec*", "*votec*") and suffix suggestions based on jurisdiction hints. Now includes automatic GLEIF search for each extracted entity to retrieve and display LEI codes directly in claims output. Skips harmful Stage 3 LLM suffix guessing in favor of presenting multiple claims with evidence. Supports 1-to-many domain-entity mappings aligned with platform philosophy. Enhanced to display comprehensive GLEIF data including jurisdiction, legal form, entity status, headquarters location, legal address, and registration status for each verified entity.
    - **MCP Arbitration Framework V1 (Updated Aug 15, 2025)**: Claims-to-arbitration system now using Perplexity API with sonar-pro model for transparent, judge-like entity ranking. Claim 0 represents LLM-extracted entity from website, Claims 1-N are GLEIF candidates. Perplexity provides comprehensive analysis with web search capabilities, incorporating real-time corporate data and citations. Arbitration applies multi-tier ranking: parent entities > subsidiaries, jurisdiction bias, entity status, legal form, and registration recency. Designed for acquisition research with emphasis on ultimate parent identification and transparent decision-making. Full implementation plan documented in `docs/MCP-Arbitration-Framework-V1.md`. Frontend integration complete with ArbitrationResults and UserBiasConfig components fully integrated into Beta V2 dashboard, supporting real-time arbitration processing with Perplexity reasoning and user preference management. Fixed critical database schema issues where queries referenced non-existent 'pages' column instead of 'dump_data' JSONB field. Entity extraction now correctly prioritizes og:site_name meta tag over page titles preventing incorrect entity searches. Arbitration now accepts existing GLEIF claims from frontend to avoid regenerating with wrong entity names.
    - **Machine-Friendly Configuration**: Centralizes extraction methods, confidence modifiers, validation rules, and jurisdiction data in TypeScript configurations for dynamic updates.
    - **Performance Optimization**: Early connectivity triage saves processing time on unreachable domains. Multi-layer timeout systems prevent processing stalls. Reduced API polling frequency (58% reduction) to minimize server load.
    - **Security Hardening (Aug 11, 2025)**: Verified SQL injection protection with parameterized queries. Fixed React Fragment issues to eliminate console warnings. Enhanced TypeScript type safety with proper ArbitrationResult types.
    - **Extraction Hierarchy**: Utilizes structured data (JSON-LD), enhanced meta properties, footer copyright, logo alt text, H1 analysis, and page title for extraction, with a focus on legal entity names.
    - **Enhanced Database Error Logging (Aug 9, 2025)**: Comprehensive error diagnostics for Beta V2 database operations including query previews, parameter type detection, size information, and specific PostgreSQL hints. Explicit JSONB casting prevents type detection errors.

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