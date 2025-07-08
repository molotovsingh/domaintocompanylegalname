
# Beta Services Legacy Archive

This directory contains obsolete and legacy files from the simplified beta architecture transition.

## Archived Files

### `betaExtractionService.ts`
- **Reason for archival**: Complex orchestration service with coupled method comparisons
- **Replaced by**: Standalone scripts (`standaloneAxiosCheerio.ts`, `standalonePuppeteer.ts`, `standalonePerplexity.ts`)
- **Issues**: Server spawning complexity, race conditions, method coupling

### `perplexityExtractor.ts`
- **Reason for archival**: Replaced by `standalonePerplexity.ts` with database integration
- **Issues**: Missing database storage integration
- **Note**: Good implementation but needed wrapper for consistency

### `puppeteerExtractor_comprehensive.ts`
- **Reason for archival**: Legacy comprehensive version with hardcoded paths
- **Issues**: Overly complex, hardcoded Chromium path, inconsistent with new architecture

### `puppeteerExtractor_old.ts`
- **Reason for archival**: Previous version of puppeteer extractor
- **Issues**: Outdated implementation, missing features

## Architecture Changes

The transition from complex service-based architecture to simple standalone scripts:

**Before**: 
- `BetaExtractionService` orchestrating multiple methods
- Server spawning and port conflicts
- Coupled method comparisons

**After**:
- Independent standalone scripts
- Direct API endpoints
- Modular, scalable for 10-15 methods
- Database isolation with `betaDb.ts`

## Recovery Instructions

If needed, these files can be restored from this archive. However, they would need significant modifications to work with the current simplified architecture.

## Recent Updates

### Puppeteer Method Removal (Current)
- **Files moved**: `puppeteerExtractor.ts`, `standalonePuppeteer.ts`
- **Reason**: Removed from beta testing system
- **Impact**: Beta system now only supports Axios+Cheerio and Perplexity methods

**Archive Date**: Current
**Transition Status**: Completed - simplified standalone beta architecture implemented, puppeteer method removed
