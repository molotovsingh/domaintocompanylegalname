
# Archived - Historical Project Files

*Last Updated: July 12, 2025 at 2:52 AM UTC*

## Purpose
This folder contains historical files, deprecated implementations, and completed research that provides valuable context for understanding the project's evolution and decision-making process.

## Folder Structure

### `/betaServices-legacy/` - Deprecated Beta Service Implementations
Historical beta service implementations that have been superseded by the current `/server/betaServices/` architecture:

- **Legacy Extractors**: Old Puppeteer, Perplexity, and Axios+Cheerio implementations
- **Standalone Services**: Independent extraction services before integration
- **Comprehensive Implementations**: Feature-complete but replaced implementations
- **Research Prototypes**: Experimental extraction approaches

### `/design-docs/` - Research & Architectural Analysis
Theoretical analysis, technology comparisons, and design proposals that informed architectural decisions:

- **Technology Evaluations**: FastAPI vs Express.js, database architecture comparisons
- **Strategic Analysis**: Domain identification strategies, data structure decisions
- **Research Documents**: Screenshot NER research, alternative extraction methods
- **Architecture Proposals**: System design options and trade-off analysis

### `/learnings/` - Critical Implementation Knowledge
Hard-won insights from actual development, debugging, and problem-solving:

- **Production Issues**: Real bugs discovered and fixed during implementation
- **Integration Challenges**: GLEIF validation issues, database schema problems
- **Performance Discoveries**: Code hygiene issues, optimization learnings
- **Architectural Checkpoints**: Major implementation milestones and status

### `/poc/` - Proof of Concept Implementations
Working prototypes and experimental implementations used for validation:

- **Analytics Server**: Python FastAPI analytics implementation
- **Domain Hashing**: Cryptographic domain identification system
- **GLEIF Intelligence**: Legal entity identifier integration prototypes
- **LLM Integration**: AI-powered extraction method experiments
- **Validation Tools**: Testing and verification utilities

## Historical Value

### Decision Context
These archived files provide crucial context for understanding:
- **Why** certain technologies were chosen over alternatives
- **How** the current architecture evolved from simpler beginnings
- **What** approaches were tried and why they were abandoned
- **When** major architectural decisions were made

### Learning Preservation
The archived materials preserve:
- **Technical Challenges**: Real problems encountered during development
- **Solution Evolution**: How solutions were refined over time
- **Performance Insights**: What works and what doesn't at scale
- **Integration Lessons**: Complex integration challenges and solutions

### Development Guidance
Future developers benefit from:
- **Avoiding Repeated Mistakes**: Known problematic approaches
- **Understanding Trade-offs**: Why current solutions were preferred
- **Accelerated Onboarding**: Context for current implementation choices
- **Research Foundation**: Starting points for future improvements

## Usage Guidelines

### When to Reference Archived Files
- **Understanding Current Architecture**: Why systems are designed the way they are
- **Debugging Similar Issues**: Learning from past problem-solving approaches
- **Extending Functionality**: Building on previous research and prototypes
- **Making Architectural Changes**: Understanding the implications of design decisions

### What NOT to Use from Archives
- **Deprecated Code**: Use current implementations in `/server/` and `/client/`
- **Outdated Patterns**: Follow current TypeScript and React patterns
- **Legacy Dependencies**: Use current package.json dependencies
- **Superseded Approaches**: Prefer current extraction methods over legacy ones

### Contributing to Archives
When adding new archived materials:
1. **Document Context**: Explain why the file is being archived
2. **Preserve Learnings**: Include insights gained during implementation
3. **Link to Current**: Reference what replaced the archived approach
4. **Timestamp Changes**: Include when and why the archival occurred

## Relationship to Current Codebase

### `/betaServices-legacy/` → `/server/betaServices/`
Legacy beta services evolved into the current modular beta architecture with improved:
- **Type Safety**: Full TypeScript implementation
- **Error Handling**: Comprehensive error management
- **Performance**: Optimized extraction methods
- **Integration**: Seamless database integration

### `/design-docs/` → Current Architecture
Research documents led to current architectural decisions:
- **Express.js over FastAPI**: Performance and ecosystem considerations
- **PostgreSQL with Drizzle**: Type-safe database operations
- **Modular Services**: Clean separation of concerns
- **Beta Isolation**: Risk-free experimental feature testing

### `/poc/` → Production Features
Proof of concepts that became production features:
- **Domain Hashing**: Duplicate detection system
- **GLEIF Integration**: Legal entity identifier enhancement
- **Analytics Framework**: Performance monitoring and reporting
- **Validation Systems**: Quality assurance automation

## Archive Maintenance

### Regular Review
- **Quarterly Assessment**: Review archived materials for continued relevance
- **Documentation Updates**: Ensure archived context remains accurate
- **Link Validation**: Verify references to current implementations
- **Knowledge Transfer**: Extract valuable insights for current documentation

### Retention Policy
- **Keep Historical Context**: Preserve decision-making rationale
- **Remove Obsolete Details**: Clean up implementation specifics that no longer apply
- **Maintain Research Value**: Preserve research and analysis that could be valuable
- **Archive Responsibly**: Don't archive just to clear up main directories

This archived material represents the intellectual journey of the Domain Intelligence Platform, providing invaluable context for understanding the current system and informing future development decisions.
