# How to Use the Free Models in Beta Data Processing

## Overview
The Beta Data Processing system has 10 free AI models you can use to extract company information from websites. Here's how to use them.

## Step 1: Collect Data First
Before using any model, you need to have data collected from a website:

1. Go to **Beta Testing V2** page
2. Choose a collection method:
   - **Crawlee Dump** - Fast, good for most sites
   - **Scrapy Crawl** - Better for complex sites
   - **Playwright Dump** - Best for JavaScript-heavy sites
3. Enter a domain (like "apple.com")
4. Click "Start Collection"
5. Wait for it to complete (usually 10-30 seconds)

## Step 2: Go to Beta Data Processing
Once you have collected data:

1. Navigate to the **Beta Data Processing** page
2. You'll see your collected data listed

## Step 3: Select Your Data
In the first section "Select Raw Data to Process":
- Click on the domain you want to process
- It will show which collection method was used
- If already processed, it shows which models were used

## Step 4: Choose Your Model
In the second section "Select Processing Model":
- Click the dropdown menu
- You'll see all 10 free models:

### Available Free Models:
1. **DeepSeek Chat** - Fast, reliable, recommended for most uses
2. **DeepSeek V3** - Latest version, more powerful
3. **DeepSeek R1 Reasoning** - Best for complex analysis
4. **Qwen 2.5 72B** - Large model, good for detailed extraction
5. **Qwen3 Coder** - Optimized for technical content
6. **Qwen3 14B** - Smaller, faster, still accurate
7. **Llama 3 8B** - Open source, good accuracy
8. **Mixtral 8x7B** - Strong performance
9. **Mistral Nemo** - Great for international sites
10. **Gemini 2.0 Flash** - Google's fastest model

## Step 5: Process the Data
1. Click the "Process Data" button
2. Wait for processing (usually 5-15 seconds)
3. Results appear below showing:
   - Company name found
   - Legal entity name
   - Addresses, phones, emails
   - Processing time and confidence score

## Tips for Best Results:

### Which Model to Choose?
- **For speed**: Use DeepSeek Chat or Gemini 2.0 Flash
- **For accuracy**: Use DeepSeek V3 or Qwen 2.5
- **For complex sites**: Use DeepSeek R1 Reasoning
- **For technical/code sites**: Use Qwen3 Coder
- **For international sites**: Use Mistral Nemo

### Can I Use Multiple Models?
Yes! You can process the same data with different models to compare results:
1. Process with one model
2. Select the same data again
3. Choose a different model
4. Process again
5. Compare the results

### Requirements:
- You need an OpenRouter API key configured in the system
- The key must have some credits (even $1 works for free models)
- Free models have 50 requests/day limit (or 1000 with $10+ credit)

### Troubleshooting:
- **"No models available"**: Check if OpenRouter API key is configured
- **"429 error"**: You've hit the rate limit, wait a bit
- **No data showing**: Make sure you collected data first in Beta Testing V2

## Understanding the Results:
- **Company Name**: The business name found
- **Legal Entity**: The official registered name (with Inc., LLC, etc.)
- **Confidence Score**: How sure the model is (0-100%)
- **Processing Time**: How long it took (faster isn't always better)
- **Token Count**: How much text was processed

Remember: All 10 models are completely free to use within the daily limits!