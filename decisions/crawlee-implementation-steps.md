# Crawlee Implementation Step-by-Step Guide

## Phase 1: Foundation (Day 1)

### Step 1: Install Dependencies
```bash
npm install crawlee
```

### Step 2: Create Database Schema
1. Create schema file: `server/beta-v2/crawlee-dump/schema.sql`
2. Add to database initialization in `server/beta-v2/database.ts`
3. Test table creation

### Step 3: Create Directory Structure
```
server/beta-v2/crawlee-dump/
├── crawleeDumpIndex.ts      # Express routes
├── crawleeDumpService.ts    # Core logic
├── crawleeDumpStorage.ts    # DB operations
├── crawleeDumpTypes.ts      # Interfaces
└── schema.sql              # Database schema
```

### Step 4: Basic Service Implementation
1. Create `crawleeDumpTypes.ts` with interfaces
2. Implement `crawleeDumpStorage.ts` with:
   - `createDump(domain, config)`
   - `updateDump(id, data)`
   - `getDump(id)`
   - `listDumps()`

### Step 5: Minimal Crawler
1. Implement basic crawler in `crawleeDumpService.ts`
2. Single page crawl first
3. Store HTML and basic metadata
4. Test with simple domain

## Phase 2: Core Features (Day 2)

### Step 6: Multi-Page Crawling
1. Add request queue handling
2. Implement depth limiting
3. Add path filtering (includePaths/excludePaths)
4. Test with multi-page site

### Step 7: Network Data Capture
1. Set up request interception
2. Capture API calls and responses
3. Store in structured format
4. Test with AJAX-heavy site

### Step 8: Session Management
1. Implement cookie persistence
2. Handle authentication states
3. Test with sites requiring login

### Step 9: Error Handling
1. Add timeout handling
2. Implement retry logic
3. Graceful failure modes
4. Clear error messages

## Phase 3: API Integration (Day 3)

### Step 10: Express Routes
Create routes in `crawleeDumpIndex.ts`:
```typescript
POST   /dump          // Start new dump
GET    /dumps         // List all dumps
GET    /dump/:id      // Get dump details
GET    /dump/:id/data // Get raw dump data
DELETE /dump/:id      // Cancel/delete dump
```

### Step 11: Route Integration
1. Add Crawlee router to `server/beta-v2/routes.ts`
2. Update health check to include 'crawlee-dump'
3. Test all endpoints

### Step 12: Status Updates
1. Real-time progress updates
2. WebSocket or polling mechanism
3. Pages crawled counter
4. Error reporting

## Phase 4: UI Development (Day 4)

### Step 13: Create UI Component
```
client/src/pages/beta-testing-v2/crawlee-dump/
└── CrawleeDumpPage.tsx
```

### Step 14: UI Features
1. Domain input field
2. Configuration controls:
   - Max pages slider (1-100)
   - Max depth slider (1-5)
   - Wait time slider (100-5000ms)
3. Start/Stop buttons
4. Progress display
5. Results summary

### Step 15: Method Selector Integration
1. Add Crawlee option to beta-v2 landing page
2. Update method selector UI
3. Add navigation route

### Step 16: Results Viewer
1. Display crawl statistics
2. List crawled URLs
3. Show data size
4. Download button for JSON export

## Phase 5: Testing & Optimization (Day 5)

### Step 17: Test Various Site Types
- Static HTML sites
- React SPAs
- E-commerce with sessions
- Sites with lazy loading
- Protected sites

### Step 18: Performance Optimization
1. Memory usage monitoring
2. Concurrent request limiting
3. Database query optimization
4. JSONB compression

### Step 19: Edge Cases
1. Handle redirects
2. Deal with rate limiting
3. Timeout handling
4. Large site handling

### Step 20: Documentation
1. API documentation
2. Usage examples
3. Configuration guide
4. Troubleshooting guide

## Checkpoints

### After Phase 1:
- [ ] Can dump single page
- [ ] Data stored in database
- [ ] Basic API endpoint works

### After Phase 2:
- [ ] Multi-page crawling works
- [ ] Network requests captured
- [ ] Session state maintained

### After Phase 3:
- [ ] All API endpoints functional
- [ ] Real-time status updates
- [ ] Error handling complete

### After Phase 4:
- [ ] UI fully functional
- [ ] Configuration controls work
- [ ] Results downloadable

### After Phase 5:
- [ ] Handles all site types
- [ ] Performance optimized
- [ ] Well documented

## Quick Start Commands

```bash
# Day 1: Setup
npm install crawlee
# Create database tables
# Implement basic service

# Day 2: Test crawler
curl -X POST http://localhost:3001/api/beta/crawlee-dump/dump \
  -H "Content-Type: application/json" \
  -d '{"domain": "example.com", "config": {"maxPages": 5}}'

# Day 3: Check API
curl http://localhost:3001/api/beta/crawlee-dump/dumps

# Day 4: Access UI
# Navigate to http://localhost:5000/beta-testing-v2
# Select "Crawlee Dump"

# Day 5: Run tests
# Test with various domains
```

## Next Action
Start with Step 1: Install Crawlee dependency