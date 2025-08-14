
#!/usr/bin/env python3
import json
import sys
import os
import re
import time
from typing import Dict, List, Any
import google.generativeai as genai

class LangExtractService:
    def __init__(self):
        # Initialize Gemini with API key
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            print("Warning: GEMINI_API_KEY environment variable not found", file=sys.stderr)
            self.model = None
            return
        
        try:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.0-flash-exp')
            print("Gemini 2.0 Flash API initialized successfully", file=sys.stderr)
        except Exception as e:
            print(f"Error initializing Gemini API: {e}", file=sys.stderr)
            self.model = None
    
    def extract_entities(self, html_content: str, schema: Dict[str, str]) -> Dict[str, Any]:
        """Extract entities using Gemini API"""
        try:
            start_time = time.time()
            
            # Strip HTML tags to get clean text
            text_content = re.sub(r'<[^>]*>', ' ', html_content)
            text_content = re.sub(r'\s+', ' ', text_content).strip()
            
            # Limit text length for demo
            if len(text_content) > 10000:
                text_content = text_content[:10000]
            
            if not self.model:
                return {
                    "error": "Gemini API key not configured",
                    "entities": [],
                    "processingTime": 0,
                    "tokensProcessed": 0,
                    "sourceMapping": [],
                    "metadata": {}
                }
            
            # Create extraction prompt based on schema
            schema_description = "\n".join([f"- {field}: {field_type}" for field, field_type in schema.items()])
            
            prompt = f"""Extract structured information from the following text.

Schema to extract:
{schema_description}

Instructions:
1. Extract ONLY the exact text from the document for each field
2. Return JSON format with field names as keys
3. If a field is not found, use null
4. Include confidence score (0-100) for each extraction
5. For company names, include legal suffixes (Inc., Ltd., LLC, etc.)

Text to analyze:
{text_content[:5000]}

Return ONLY valid JSON in this format:
{{
  "extractions": {{
    "field_name": {{
      "value": "extracted text",
      "confidence": 85,
      "context": "surrounding text where found"
    }}
  }}
}}"""
            
            # Call Gemini API
            response = self.model.generate_content(prompt)
            
            # Parse the response
            response_text = response.text
            # Try to extract JSON from response
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
            if json_match:
                result_json = json.loads(json_match.group())
            else:
                result_json = {"extractions": {}}
            
            # Process results into our expected format
            entities = []
            extractions = result_json.get("extractions", {})
            
            for field_name, extraction_data in extractions.items():
                if extraction_data and extraction_data.get("value"):
                    # Try to find the position in original text
                    value = extraction_data["value"]
                    start_pos = text_content.find(value)
                    end_pos = start_pos + len(value) if start_pos != -1 else -1
                    
                    entities.append({
                        "text": value,
                        "type": field_name,
                        "confidence": extraction_data.get("confidence", 50) / 100.0,
                        "sourceLocation": {
                            "start": start_pos if start_pos != -1 else 0,
                            "end": end_pos if end_pos != -1 else len(value),
                            "context": extraction_data.get("context", "")
                        }
                    })
            
            processing_time = int((time.time() - start_time) * 1000)
            
            return {
                "entities": entities,
                "processingTime": processing_time,
                "tokensProcessed": len(text_content.split()),
                "sourceMapping": [
                    {
                        "text": entity["text"],
                        "originalPosition": entity["sourceLocation"]["start"],
                        "extractedPosition": i
                    } for i, entity in enumerate(entities)
                ],
                "metadata": {
                    "language": "en",
                    "documentLength": len(text_content),
                    "chunkCount": 1,
                    "model": "gemini-2.0-flash-exp"
                }
            }
            
        except Exception as e:
            return {
                "error": str(e),
                "entities": [],
                "processingTime": 0,
                "tokensProcessed": 0,
                "sourceMapping": [],
                "metadata": {}
            }

def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python langextractService.py <html_content> <schema_json>"}))
        sys.exit(1)
    
    html_content = sys.argv[1]
    schema_json = sys.argv[2]
    
    try:
        schema = json.loads(schema_json)
        service = LangExtractService()
        result = service.extract_entities(html_content, schema)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
