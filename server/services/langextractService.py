
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
            
            # Create LangExtract-style prompt description
            prompt_description = f"""Extract structured legal entity information from the following text.
Use exact text for extractions. Do not paraphrase or overlap entities.
Focus on complete legal entity names with their proper suffixes.
For domain {domain or 'unknown'}, prioritize entities that match the domain ownership."""

            # Create schema-based examples (simplified for demonstration)
            schema_fields = list(schema.keys())
            
            # Generate examples based on schema type
            if 'legal_entity_name' in schema_fields:
                example_text = "Copyright © 2024 Apple Inc. All rights reserved. Apple Inc. is a multinational technology company."
                example_extractions = [
                    {
                        "extraction_class": "legal_entity_name",
                        "extraction_text": "Apple Inc.",
                        "attributes": {"confidence": 95, "source": "copyright_notice"}
                    }
                ]
            elif 'company_name' in schema_fields:
                example_text = "Welcome to Microsoft Corporation. Microsoft Corporation provides cloud services."
                example_extractions = [
                    {
                        "extraction_class": "company_name", 
                        "extraction_text": "Microsoft Corporation",
                        "attributes": {"confidence": 90, "legal_suffix": "Corporation"}
                    }
                ]
            else:
                # Generic example for other schemas
                example_text = "Contact Meta Platforms, Inc. for more information about our services."
                example_extractions = []
                for field in schema_fields[:2]:  # Limit to first 2 fields for example
                    if 'name' in field.lower() or 'entity' in field.lower():
                        example_extractions.append({
                            "extraction_class": field,
                            "extraction_text": "Meta Platforms, Inc.",
                            "attributes": {"confidence": 85}
                        })

            # Build the structured prompt following LangExtract patterns
            prompt = f"""Extract structured information using the following schema and examples as guidance.

EXTRACTION TASK:
{prompt_description}

SCHEMA FIELDS TO EXTRACT:
{chr(10).join([f"- {field}: {field_type}" for field, field_type in schema.items()])}

HIGH-QUALITY EXAMPLE:
Text: "{example_text}"
Expected Extractions:
{chr(10).join([f"  - {ex['extraction_class']}: '{ex['extraction_text']}' (confidence: {ex['attributes'].get('confidence', 80)})" for ex in example_extractions])}

CRITICAL EXTRACTION RULES:
1. Extract COMPLETE legal entity names with suffixes (Inc., Ltd., LLC, Corp., etc.)
2. For domain {domain or 'any domain'}: prioritize entities matching domain ownership
3. Search in: copyright notices, legal disclaimers, about sections, footer information
4. Use exact text from document - do not paraphrase
5. For arrays: extract ALL relevant instances, not just the first
6. Include confidence score (0-100) for each extraction

TEXT TO ANALYZE:
{text_content[:5000]}

RESPONSE FORMAT (JSON only):
{{
  "extractions": {{
    "field_name": {{
      "value": "extracted text",
      "confidence": 85,
      "context": "surrounding text where found",
      "extraction_method": "copyright_notice|footer|about_section|general"
    }}
  }}
}}"""
            
            # Call Gemini API with timeout protection
            try:
                response = self.model.generate_content(prompt)
                
                if not response or not hasattr(response, 'text'):
                    print(f"Error: Invalid response from {self.model_name}", file=sys.stderr)
                    return {
                        "error": f"Invalid response from {self.model_name}",
                        "entities": [],
                        "processingTime": int((time.time() - start_time) * 1000),
                        "tokensProcessed": 0,
                        "sourceMapping": [],
                        "metadata": {"model": self.model_name}
                    }
                
                # Parse the response
                response_text = response.text
                print(f"[LangExtract] Response length: {len(response_text)}", file=sys.stderr)
                
                # Try to extract JSON from response
                json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
                if json_match:
                    result_json = json.loads(json_match.group())
                else:
                    # If no JSON found, try to parse the entire response
                    try:
                        result_json = json.loads(response_text)
                    except json.JSONDecodeError:
                        print(f"[LangExtract] No valid JSON found in response", file=sys.stderr)
                        result_json = {"extractions": {}}
                        
            except Exception as api_error:
                print(f"Error calling {self.model_name} API: {api_error}", file=sys.stderr)
                return {
                    "error": f"{self.model_name} API error: {str(api_error)}",
                    "entities": [],
                    "processingTime": int((time.time() - start_time) * 1000),
                    "tokensProcessed": 0,
                    "sourceMapping": [],
                    "metadata": {"model": self.model_name}
                }
            
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
