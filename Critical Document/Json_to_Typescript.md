Based on your GLEIF API integration context, you're asking about sending JSON data to TypeScript. Here are the best approaches and libraries for handling JSON data in TypeScript:

## Built-in JSON Handling (No Library Needed)

TypeScript has excellent built-in JSON support that works well for most cases:

```typescript
// Parsing JSON (what you're already doing)
const jsonData = JSON.parse(responseString);

// Sending JSON data
const jsonString = JSON.stringify(dataObject);

// With type safety
interface ApiRequest {
  companyName: string;
  searchType: 'exact' | 'fuzzy';
}

const requestData: ApiRequest = {
  companyName: "Apple Inc",
  searchType: "exact"
};

const jsonPayload = JSON.stringify(requestData);
```

## Recommended Libraries for Enhanced JSON Handling

### 1. **Zod** (Highly Recommended)
Perfect for runtime validation and type safety:

```typescript
import { z } from 'zod';

// Define schema
const GLEIFRequestSchema = z.object({
  companyName: z.string().min(1),
  searchType: z.enum(['exact', 'fuzzy']),
  maxResults: z.number().optional().default(5)
});

// Type inference
type GLEIFRequest = z.infer;

// Validate incoming JSON
function processRequest(jsonData: unknown): GLEIFRequest {
  return GLEIFRequestSchema.parse(jsonData); // Throws if invalid
}
```

### 2. **io-ts** (Alternative to Zod)
Similar runtime validation with functional programming approach:

```typescript
import * as t from 'io-ts';

const GLEIFRequestCodec = t.type({
  companyName: t.string,
  searchType: t.union([t.literal('exact'), t.literal('fuzzy')]),
  maxResults: t.union([t.number, t.undefined])
});

type GLEIFRequest = t.TypeOf;
```

### 3. **Class-validator** (For Class-based Validation)
If you prefer class-based approach:

```typescript
import { IsString, IsEnum, IsOptional, IsNumber } from 'class-validator';

class GLEIFRequest {
  @IsString()
  companyName: string;

  @IsEnum(['exact', 'fuzzy'])
  searchType: 'exact' | 'fuzzy';

  @IsOptional()
  @IsNumber()
  maxResults?: number;
}
```

## For Your GLEIF API Use Case

Given your current code, here's how you could improve JSON handling:

```typescript
import { z } from 'zod';

// Define request schema
const GLEIFSearchRequestSchema = z.object({
  companyName: z.string().min(1),
  fuzzySearch: z.boolean().default(false),
  maxResults: z.number().min(1).max(50).default(5)
});

type GLEIFSearchRequest = z.infer;

// Define response schema for validation
const GLEIFApiResponseSchema = z.object({
  data: z.array(z.object({
    id: z.string(),
    attributes: z.object({
      lei: z.string(),
      entity: z.object({
        legalName: z.object({
          name: z.string(),
          language: z.string().optional()
        }),
        status: z.string(),
        // ... other fields
      })
    })
  })),
  meta: z.object({
    pagination: z.object({
      total: z.number()
    }).optional()
  }).optional()
});

// Updated extractor method
export class GLEIFExtractor {
  async extractCompanyInfo(requestData: unknown): Promise {
    // Validate input
    const validatedRequest = GLEIFSearchRequestSchema.parse(requestData);

    // Your existing logic...
    const result = await this.searchGLEIF(validatedRequest.companyName, validatedRequest.fuzzySearch);

    // Validate API response
    const validatedResponse = GLEIFApiResponseSchema.parse(result);

    return this.formatGLEIFResult(validatedResponse.data[0], validatedResponse.data.length);
  }
}
```

## Installation Commands for Replit

```bash
# For Zod (recommended)
npm install zod

# For io-ts
npm install io-ts fp-ts

# For class-validator
npm install class-validator class-transformer reflect-metadata
```

## Recommendation for Your Project

For your GLEIF API integration, I'd recommend **Zod** because:

- **Runtime validation** - Catches invalid JSON at runtime
- **Type inference** - Automatically generates TypeScript types
- **Great error messages** - Helpful for debugging API responses
- **Lightweight** - Small bundle size
- **Excellent TypeScript support** - Built specifically for TypeScript

This will help you catch those HTML-instead-of-JSON errors early and provide better type safety for your API interactions.