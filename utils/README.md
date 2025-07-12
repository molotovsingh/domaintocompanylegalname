
# Utils - Shared Utility Functions

**Created:** January 11, 2025, 2:44 AM UTC  
**Last Updated:** January 11, 2025, 2:44 AM UTC

## Purpose
This folder contains shared utility functions used across the Domain Intelligence Platform. These utilities provide common functionality like timestamp generation, formatting, and other helper functions.

## Utilities

### **Timestamp Utilities (`timestamp.ts`)**
- **`getCurrentTimestamp()`** - Returns current UTC timestamp in ISO format
- **`formatTimestamp()`** - Formats timestamps for human-readable display
- **`getFormattedDate()`** - Returns current date in various formats
- **`createTimestampForFiles()`** - Creates filesystem-safe timestamp strings

### **Usage Examples**
```typescript
import { getCurrentTimestamp, formatTimestamp } from '../utils/timestamp';

// Get current timestamp for database records
const now = getCurrentTimestamp();

// Format for display
const displayTime = formatTimestamp(now);

// For README files and documentation
const readmeTimestamp = getFormattedDate('readme');
```

## Design Principles
- **Consistent Formatting**: All timestamps follow ISO 8601 standard
- **UTC-First**: All internal timestamps use UTC to avoid timezone issues
- **Human-Readable**: Display formats optimized for user interfaces
- **File-Safe**: Filesystem-safe timestamp formats for logs and exports
