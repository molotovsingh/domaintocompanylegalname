
#!/usr/bin/env python3
import json
import sys
import os
import re
import time
from typing import Dict, List, Any
import google.generativeai as genai

class LangExtractService:
    def __init__(self, model_name='gemini-2.5-flash'):
        # Initialize Gemini with API key
        api_key = os.environ.get('GEMINI_API_KEY')
        if not api_key:
            print("Warning: GEMINI_API_KEY environment variable not found", file=sys.stderr)
            self.model = None
            self.model_name = model_name
            return
        
        try:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel(model_name)
            self.model_name = model_name
            print(f"{model_name} API initialized successfully", file=sys.stderr)
        except Exception as e:
            print(f"Error initializing {model_name} API: {e}", file=sys.stderr)
            self.model = None
            self.model_name = model_name
    
    def extract_entities(self, html_content: str, schema: Dict[str, str], domain: str = None) -> Dict[str, Any]:
        """Extract entities using Gemini API"""
        try:
            start_time = time.time()
            
            # Strip HTML tags to get clean text
            text_content = re.sub(r'<[^>]*>', ' ', html_content)
            text_content = re.sub(r'\s+', ' ', text_content).strip()
            
            # Pre-process to find legal entities with suffixes (capture full name)
            legal_suffixes = [
                r'\b([A-Z][A-Za-z0-9\s&\.\-]+\s+(?:Limited|Ltd\.?|Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation))\b',
                r'\b([A-Z][A-Za-z0-9\s&\.\-]+\s+(?:Private\s+Limited|Pvt\.?\s+Ltd\.?|Public\s+Limited\s+Company|PLC))\b',
                r'\b([A-Z][A-Za-z0-9\s&\.\-]+\s+(?:GmbH|S\.A\.|B\.V\.|AG|AB|AS|S\.p\.A\.))\b'
            ]
            
            found_entities = []
            for pattern in legal_suffixes:
                matches = re.findall(pattern, text_content, re.IGNORECASE)
                found_entities.extend(matches)
            
            # Add hint about found entities to the beginning of text
            if found_entities:
                # Remove duplicates and limit to first 10 entities
                unique_entities = list(set(found_entities))[:10]
                
                # Extract domain name for prioritization hint
                domain_hint = ""
                if domain:
                    domain_name = domain.replace('.com', '').replace('.in', '').replace('.org', '').replace('.net', '')
                    domain_hint = f"[DOMAIN: {domain_name}] "
                
                entity_hint = f"{domain_hint}[LEGAL ENTITIES FOUND: {', '.join(unique_entities)}] "
                text_content = entity_hint + text_content
                
                # Add count if many entities found
                if len(unique_entities) > 5:
                    entity_hint = f"{domain_hint}[{len(unique_entities)} LEGAL ENTITIES FOUND: {', '.join(unique_entities)}] "
                    text_content = entity_hint + text_content
            
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

CRITICAL Instructions:
1. For company_name or legal_entity_name fields: Look for the LEGAL ENTITY NAME with suffixes like:
   - Limited, Ltd., Inc., Incorporated, LLC, Corp., Corporation
   - Private Limited, Pvt. Ltd., Public Limited Company, PLC
   - GmbH, S.A., B.V., AG, AB, AS
   Examples: "Living Media India Limited" NOT just "India Today"
             "Apple Inc." NOT just "Apple"
2. For arrays (subsidiaries, brand_names): Extract ALL occurrences, not just the first one
3. For primary_entity or legal_entity_name: 
   - PRIORITIZE the entity that matches the domain name (e.g., for elcomponics.com, prefer "ELcomponics Sales Private Limited")
   - Look for the company that OWNS the website, not subsidiaries or partners
   - The entity should match the domain prefix when possible
4. For subsidiaries: Include ALL related companies, joint ventures, divisions BUT not as the primary entity
5. Search for these patterns:
   - Copyright notices (© or "Copyright")
   - Legal disclaimers
   - About us sections
   - Terms of service mentions
6. If both a brand name and legal entity exist, ALWAYS prefer the legal entity
7. For corporate_suffix field: Extract ONLY the suffix part (e.g., "Limited", "Inc.", "LLC")
8. For brand_name/brand_names fields: Extract the common/marketing name WITHOUT legal suffixes
9. Extract ONLY exact text from the document
10. Include confidence score (0-100) for each extraction
11. Return null if field is not found

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
                    "model": self.model_name
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
    try:
        # Read input data from stdin to handle large content
        input_data = sys.stdin.read()
        
        if not input_data:
            print(json.dumps({"error": "No input data received"}))
            sys.exit(1)
        
        # Parse the input JSON containing content, schema, domain, and model
        data = json.loads(input_data)
        html_content = data.get('content', '')
        schema = data.get('schema', {})
        domain = data.get('domain', '')
        model_name = data.get('model_name', 'gemini-2.5-flash')
        
        if not html_content or not schema:
            print(json.dumps({"error": "Missing content or schema in input"}))
            sys.exit(1)
        
        service = LangExtractService(model_name)
        result = service.extract_entities(html_content, schema, domain)
        print(json.dumps(result))
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid JSON input: {str(e)}"}))
        sys.exit(1)
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
