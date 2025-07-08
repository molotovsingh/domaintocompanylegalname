
# Perplexity Usage Guide

## Key Perplexity Usage Learnings

### 1. **API Configuration**
- Use `https://api.perplexity.ai` as the base URL
- Model: `sonar` (current recommended model)
- Temperature: 0.1 (for consistent, factual responses)
- Max tokens: 300-500 (depending on complexity)

### 2. **Prompt Engineering Best Practices**
- **Be specific** about the domain you're analyzing
- **Request structured JSON output** for consistent parsing
- **Include specific fields** you want extracted (company name, country, legal entity type)
- **Use clear instructions** about what constitutes a "company name"

### 3. **Response Handling**
- **Always try JSON parsing first** - Perplexity often returns well-structured JSON
- **Have fallback text parsing** for when JSON fails
- **Look for key phrases** like "company", "name", "corporation" in fallback mode
- **Extract from multiple lines** if needed

### 4. **Error Management**
- **Check for API key** before making requests
- **Handle network timeouts** gracefully
- **Provide meaningful error messages** in responses
- **Log both successes and failures** for debugging

### 5. **Current Implementation Insights**
The current implementation follows these best practices:

- ✅ Uses proper OpenAI client with Perplexity base URL
- ✅ Structured JSON prompt requesting specific fields
- ✅ Fallback text parsing when JSON fails
- ✅ Proper error handling with meaningful messages
- ✅ Reasonable confidence scoring (80% for found companies)

### 6. **Performance Considerations**
- **Processing time tracking** is important for monitoring
- **Rate limiting** may be needed for high-volume usage
- **Caching results** can improve efficiency
- **Confidence scoring** helps filter quality results

### 7. **Model Evolution**
- The model name has evolved from `llama-3.1-sonar-small-128k-online` to simply `sonar`
- The `sonar` model provides the same online search capabilities
- Always check the latest Perplexity API documentation for model updates

### 8. **Example Implementation**
```typescript
const response = await this.client.chat.completions.create({
  model: 'sonar',
  messages: [
    {
      role: 'user',
      content: `Find the official company name for: ${domain}
      
      Search for the legal entity name, not marketing names.
      Respond in JSON format with keys: companyName, country, legalEntityType`
    }
  ],
  temperature: 0.1,
  max_tokens: 400
});
```

### 9. **Quality Assurance**
- Validate extracted company names against business suffixes
- Cross-reference with GLEIF data when available
- Implement confidence scoring based on source reliability
- Monitor extraction accuracy over time

This guide represents learnings from production usage and should be referenced when implementing or debugging Perplexity-based extraction systems.
