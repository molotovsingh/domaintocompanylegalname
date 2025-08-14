
#!/usr/bin/env python3
import json
import sys
import os
from typing import Dict, List, Any
import langextract as lx

class LangExtractService:
    def __init__(self):
        # Initialize LangExtract with appropriate model
        # You'll need to set LANGEXTRACT_API_KEY in your environment
        pass
    
    def extract_entities(self, html_content: str, schema: Dict[str, str]) -> Dict[str, Any]:
        """Extract entities using the real LangExtract library"""
        try:
            # Strip HTML tags to get clean text
            import re
            text_content = re.sub(r'<[^>]*>', ' ', html_content)
            text_content = re.sub(r'\s+', ' ', text_content).strip()
            
            # Create LangExtract prompt based on schema
            schema_description = "\n".join([f"- {field}: {field_type}" for field, field_type in schema.items()])
            
            prompt = f"""
            Extract structured information from the following text based on this schema:
            {schema_description}
            
            Use exact text for extractions. Do not paraphrase or infer information not present in the text.
            """
            
            # Create few-shot examples based on schema
            examples = []
            for field_name, field_type in schema.items():
                if 'company' in field_name.lower() or 'name' in field_name.lower():
                    examples.append({
                        "text": "Apple Inc. is a technology company",
                        field_name: "Apple Inc."
                    })
                elif 'email' in field_name.lower():
                    examples.append({
                        "text": "Contact us at info@example.com",
                        field_name: "info@example.com"
                    })
                break  # Just one example for demo
            
            # Use LangExtract to perform extraction
            extractor = lx.LangExtract()
            
            # Run extraction
            results = extractor.extract(
                text=text_content,
                prompt=prompt,
                examples=examples
            )
            
            # Process results into our expected format
            entities = []
            for result in results.entities:
                entities.append({
                    "text": result.text,
                    "type": result.entity_type,
                    "confidence": result.confidence,
                    "sourceLocation": {
                        "start": result.start_pos,
                        "end": result.end_pos,
                        "context": text_content[max(0, result.start_pos-50):result.end_pos+50]
                    }
                })
            
            return {
                "entities": entities,
                "processingTime": results.processing_time_ms,
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
                    "chunkCount": 1
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
