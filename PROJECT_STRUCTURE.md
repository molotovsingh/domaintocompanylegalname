# Project Structure Guide

## Overview
This guide helps you navigate the Domain Intelligence Platform codebase and understand where to find different types of information.

## 📁 Main Folders

### `/client` - Frontend Application
- React + TypeScript application
- UI components and pages
- API integration

### `/server` - Backend Services  
- Express.js API server
- Domain extraction services
- GLEIF integration
- Beta testing services

### `/shared` - Shared Code
- TypeScript schemas
- Type definitions  
- Shared utilities

### `/docs` - Documentation
- `/current` - Active documentation
- `/journey` - Project evolution history

### `/archived` - Historical Files
- `/design-docs` - Research and proposals
- `/learnings` - Critical insights from implementation
- `/poc` - Proof of concept implementations

### `/test-data` - Test Files
- Sample domains
- Test cases
- Validation data

### `/scripts` - Utility Scripts
- Server management scripts
- Batch recovery utilities
- Navigation flow checks

### `/HowTo` - Technical Guides & Testing
- API documentation (GLEIF, Perplexity)
- Testing scripts and validation tools
- Proof of concept implementations
- Technical conventions and guides

### `/logs` - Application Logs
- Server logs
- Beta server logs
- Processing logs

### `/decisions` - Architectural Decisions
- Key decisions and rationale
- Technology choices
- Design patterns

## 🗺️ Where to Start

1. **New to the project?** Start with `replit.md` for overview
2. **Understanding the journey?** Check `docs/journey/`
3. **Looking for API docs?** See `docs/current/`
4. **Debugging an issue?** Check `archived/learnings/` for similar problems
5. **Making architectural changes?** Document in `decisions/`

## 📝 Key Files

- `replit.md` - Main project documentation
- `package.json` - Dependencies and scripts
- `drizzle.config.ts` - Database configuration
- `shared/schema.ts` - Database schema
- `server/routes.ts` - API endpoints

## 🔍 Finding Things

- **Production code**: `/client/src` and `/server`
- **Test/experimental code**: `/scripts` and `/archived/poc`
- **Configuration**: Root directory (*.config.ts, *.json)
- **Documentation**: `/docs`, `/archived/learnings`, `/decisions`

## 💡 Contributing

When adding new features:
1. Update `replit.md` with architectural changes
2. Document decisions in `/decisions`
3. Add learnings to `/archived/learnings` if you solve complex problems
4. Keep `/docs/current` up to date

Remember: Good organization helps future developers (including future you!) understand the codebase faster.