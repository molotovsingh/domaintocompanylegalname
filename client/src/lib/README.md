
# Client Libraries

*Created: July 12, 2025 at 2:52 AM UTC*

This directory contains core libraries and utilities that power the Domain Intelligence Platform frontend application.

## Core Libraries

### **`queryClient.ts`**
React Query configuration and API request utilities:

```typescript
import { queryClient, apiRequest } from "./queryClient"

// API request with error handling
const response = await apiRequest('POST', '/api/batches', formData)

// Query configuration with caching
const { data, isLoading } = useQuery({
  queryKey: ['batches'],
  queryFn: () => fetch('/api/batches').then(res => res.json())
})
```

**Features:**
- Centralized API request handling with error management
- Response validation and status checking
- FormData and JSON request support
- 401 unauthorized handling with configurable behavior
- 30-second default stale time for efficient caching
- No automatic retries for predictable behavior

**Configuration:**
- Default query function with error handling
- Credential inclusion for authenticated requests
- Disabled refetch on window focus for performance
- Custom error throwing for failed responses

### **`utils.ts`**
Common utility functions and helper methods:

```typescript
import { cn, formatDate, truncateText } from "./utils"

// Class name merging
const className = cn("base-class", condition && "conditional-class")

// Utility functions for common operations
const formattedDate = formatDate(new Date())
const shortened = truncateText(longString, 100)
```

**Features:**
- Class name merging with clsx and tailwind-merge
- Date formatting utilities
- String manipulation helpers
- Type-safe utility functions
- Consistent formatting across the application

## Architecture Patterns

### **API Request Flow**
```
Component → useQuery/useMutation → queryClient → apiRequest → Backend API
```

### **Error Handling Strategy**
1. **Network Errors**: Automatic retry logic disabled for predictable behavior
2. **HTTP Errors**: Thrown as errors with status codes and messages
3. **Unauthorized**: Configurable behavior (throw or return null)
4. **Validation**: Response validation before data processing

### **Caching Strategy**
- **Stale Time**: 30 seconds default for balance of freshness and performance
- **Cache Invalidation**: Manual invalidation on mutations
- **Background Refetch**: Disabled automatic refetch for user control
- **Query Keys**: Structured keys for efficient cache management

## Development Guidelines

### **Adding New Utilities**
1. Create type-safe function signatures
2. Include comprehensive JSDoc comments
3. Add unit tests for utility functions
4. Follow existing naming conventions
5. Export from main utils file

### **API Integration**
1. Use apiRequest for all backend communication
2. Implement proper error boundaries
3. Structure query keys consistently
4. Handle loading and error states appropriately

### **Type Safety**
- All utilities include full TypeScript definitions
- Generic functions for reusable patterns
- Interface definitions for complex data structures
- Strict type checking for API responses

## Performance Considerations

### **Bundle Optimization**
- Tree-shakeable exports for minimal bundle size
- Lazy loading for heavy utilities
- Efficient dependency management

### **Runtime Performance**
- Memoized expensive operations
- Optimized re-render prevention
- Efficient data transformation utilities

These libraries provide the foundation for consistent, efficient, and type-safe development across the Domain Intelligence Platform frontend application.
