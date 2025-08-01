# How-To: Technical Guides & Testing Documentation

This folder contains all technical implementation guides, API documentation, testing scripts, and proof-of-concept code for the Domain Intelligence Platform.

## 📚 API Documentation

### GLEIF Integration
- **GLEIFHowTo.md** - Complete guide to using the GLEIF API for legal entity lookups
- **GLEIF_Tested_Code** - Working code examples for GLEIF integration
- **gleif_intelligence_poc.js** - Proof of concept for advanced GLEIF features

### External Services
- **PerplexityHowTo.md** - Guide to integrating Perplexity AI for enhanced search
- **axios-cheerio-dump-API.md** - API documentation for the Axios+Cheerio dump service
- **beta-v2-conventions.md** - Technical conventions for Beta V2 federation architecture

### OpenRouter Integration
- **openrouter-smoke-test.ts** - Complete testing suite for OpenRouter models
- **check-open-models.ts** - Script to verify available OpenRouter models

## 🧪 Testing Scripts

### GLEIF Testing Suite
- **test_gleif_connection.js** - Basic connectivity test for GLEIF API
- **test_gleif_validation.js** - Validation accuracy testing
- **test_gleif_debug.js** - Detailed debugging utilities
- **test_wildenstein_gleif.js** - Specific case study validation

### Extraction Testing
- **extract_footer.js** - Test footer-based company name extraction
- **extract_exxon_footer.js** - Specific case study for Exxon domain
- **test_geographic_extraction.js** - Geographic domain extraction validation
- **level1_extraction_demo.js** - Level 1 extraction demonstration

### System Integration Testing
- **test-beta-server.js** - Beta server functionality tests
- **test_fastapi_integration.py** - FastAPI analytics server testing
- **start-beta-server.sh** - Shell script for beta server startup

### Data Cleaning Tests
- **test-regex-cleaning.ts** - Regular expression cleaning validation
- **test-non-english-cleaning.ts** - International content cleaning tests

## 🛠️ Proof of Concept Code

### Advanced Features
- **llm_ner_poc_framework.js** - LLM-based Named Entity Recognition framework
- **domain_hash_service.py** - Domain hashing implementation for deduplication

## 📖 Usage Examples

### Testing GLEIF Connection
```bash
node test_gleif_connection.js
```

### Running OpenRouter Tests
```bash
tsx openrouter-smoke-test.ts
```

### Testing Extraction Methods
```bash
node extract_footer.js "example.com"
```

### Starting Beta Server
```bash
./start-beta-server.sh
```

## 🎯 Quick Start Guide

1. **API Integration**: Start with GLEIFHowTo.md and PerplexityHowTo.md for external service setup
2. **Testing**: Use the test scripts to validate your setup
3. **Development**: Reference the POC code for implementation patterns
4. **Conventions**: Follow beta-v2-conventions.md for consistent development

## 📝 Notes

- All test scripts are standalone and can be run independently
- API documentation includes authentication setup and rate limiting guidance
- POC code demonstrates advanced features that may not be in production yet
- Testing scripts include both unit tests and integration tests

## 🔧 Maintenance

When adding new technical documentation:
1. Place API guides in this folder with descriptive names
2. Add test scripts with `test_` prefix
3. Include POC code with `_poc` suffix
4. Update this README with the new addition