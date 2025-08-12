"""
FastAPI Processing Service for Beta V2
Handles dump processing through cleaning and entity extraction stages
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import asyncio
import aiohttp
import asyncpg
import json
import os
import re
from datetime import datetime
from bs4 import BeautifulSoup
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Beta V2 Processing Service")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection pool
db_pool = None

# OpenRouter configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

class ProcessRequest(BaseModel):
    source_type: str
    source_id: int
    priority: str = "normal"

class ProcessingResponse(BaseModel):
    success: bool
    processing_id: Optional[int] = None
    message: str

class EntityExtractor:
    """Efficient entity extraction from HTML content"""
    
    def __init__(self):
        self.corporate_suffixes = [
            'Inc', 'Corp', 'LLC', 'Ltd', 'GmbH', 'AG', 'SA', 'SAS', 
            'SpA', 'BV', 'NV', 'Pty', 'PLC', 'SE', 'Limited', 
            'Corporation', 'Company', 'Incorporated'
        ]
        
    def extract_from_html(self, html_content: str, domain: str) -> Dict[str, Any]:
        """Extract structured data from HTML without LLM calls"""
        soup = BeautifulSoup(html_content, 'lxml')
        
        # Remove script and style elements
        for script in soup(["script", "style"]):
            script.decompose()
        
        result = {
            'domain': domain,
            'title': None,
            'meta_tags': {},
            'structured_data': [],
            'company_name': None,
            'primary_entity': None,
            'entities': [],
            'addresses': [],
            'emails': [],
            'phones': []
        }
        
        # Extract title
        title_tag = soup.find('title')
        if title_tag:
            result['title'] = title_tag.get_text().strip()
            # Try to extract entity from title
            entity = self._clean_title_entity(result['title'])
            if entity:
                result['entities'].append(entity)
        
        # Extract meta tags
        for meta in soup.find_all('meta'):
            name = meta.get('name') or meta.get('property')
            content = meta.get('content')
            if name and content:
                result['meta_tags'][name] = content
                
                # Extract entity from og:site_name
                if name == 'og:site_name':
                    entity = self._clean_entity_name(content)
                    if entity:
                        result['entities'].append(entity)
                        if not result['primary_entity']:
                            result['primary_entity'] = entity
        
        # Extract JSON-LD structured data
        for script in soup.find_all('script', type='application/ld+json'):
            try:
                data = json.loads(script.string)
                result['structured_data'].append(data)
                
                # Extract organization name
                if isinstance(data, dict):
                    if data.get('@type') == 'Organization':
                        name = data.get('name')
                        if name:
                            result['entities'].append(name)
                            if not result['company_name']:
                                result['company_name'] = name
            except json.JSONDecodeError:
                pass
        
        # Extract from copyright notices
        text = soup.get_text()
        copyright_patterns = [
            r'(?:©|Copyright)\s+(?:\d{4}\s+)?([A-Z][A-Za-z0-9\s&.,\'-]+?)(?:\.|,|\s+All|\s+Rights)',
            r'©\s*(\d{4})?\s*([A-Z][A-Za-z0-9\s&.,\'-]+?)(?:\.|,|\s|$)'
        ]
        
        for pattern in copyright_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                entity = match[1] if isinstance(match, tuple) else match
                entity = self._clean_entity_name(entity)
                if entity and len(entity) > 2:
                    result['entities'].append(entity)
        
        # Extract emails
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, text)
        result['emails'] = list(set(emails))[:5]  # Limit to 5 unique emails
        
        # Extract phone numbers
        phone_pattern = r'[\+]?[(]?[0-9]{1,3}[)]?[-\s\.]?[(]?[0-9]{1,3}[)]?[-\s\.]?[0-9]{3,4}[-\s\.]?[0-9]{3,4}'
        phones = re.findall(phone_pattern, text)
        result['phones'] = list(set(phones))[:5]  # Limit to 5 unique phones
        
        # Deduplicate and clean entities
        result['entities'] = list(set(filter(None, result['entities'])))
        
        # Set primary entity if not already set
        if not result['primary_entity'] and result['entities']:
            # Prefer entities with corporate suffixes
            for entity in result['entities']:
                if self._has_corporate_suffix(entity):
                    result['primary_entity'] = entity
                    break
            
            # Otherwise use the first entity
            if not result['primary_entity']:
                result['primary_entity'] = result['entities'][0]
        
        return result
    
    def _clean_title_entity(self, title: str) -> Optional[str]:
        """Extract entity name from page title"""
        if not title:
            return None
            
        # Remove common separators and everything after
        cleaned = re.split(r'\s*[\|–\-:]\s*', title)[0]
        
        # Remove common prefixes
        prefixes = ['Welcome to', 'Home', 'About', 'Official Website of']
        for prefix in prefixes:
            if cleaned.lower().startswith(prefix.lower()):
                cleaned = cleaned[len(prefix):].strip()
        
        # Remove marketing terms
        marketing_terms = ['Services', 'Solutions', 'Products', 'Website']
        for term in marketing_terms:
            cleaned = re.sub(f'\\s+{term}\\s*$', '', cleaned, flags=re.IGNORECASE)
        
        return cleaned if len(cleaned) > 2 else None
    
    def _clean_entity_name(self, name: str) -> Optional[str]:
        """Clean and validate entity name"""
        if not name:
            return None
            
        # Remove extra whitespace
        name = ' '.join(name.split())
        
        # Remove trailing punctuation
        name = re.sub(r'[.,;!?]+$', '', name)
        
        # Check if it's too long (likely a sentence)
        if len(name) > 100:
            return None
            
        # Check if it's too short
        if len(name) < 3:
            return None
            
        return name
    
    def _has_corporate_suffix(self, name: str) -> bool:
        """Check if name has a corporate suffix"""
        name_lower = name.lower()
        for suffix in self.corporate_suffixes:
            if name_lower.endswith(suffix.lower()) or name_lower.endswith(f'{suffix.lower()}.'):
                return True
        return False

async def init_db():
    """Initialize database connection pool"""
    global db_pool
    DATABASE_URL = os.getenv("DATABASE_URL")
    if DATABASE_URL:
        db_pool = await asyncpg.create_pool(DATABASE_URL, min_size=2, max_size=10)
        logger.info("Database pool created")

async def get_dump_data(source_type: str, source_id: int) -> Optional[Dict]:
    """Retrieve dump data from database"""
    if not db_pool:
        return None
    
    table_map = {
        'crawlee_dump': 'crawlee_dumps',
        'scrapy_crawl': 'scrapy_crawls',
        'playwright_dump': 'playwright_dumps',
        'axios_cheerio_dump': 'axios_cheerio_dumps'
    }
    
    table = table_map.get(source_type)
    if not table:
        return None
    
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow(
            f"SELECT * FROM {table} WHERE id = $1",
            source_id
        )
        
        if row:
            return dict(row)
    
    return None

async def save_processing_result(
    source_type: str,
    source_id: int,
    domain: str,
    extracted_data: Dict
) -> int:
    """Save processing result to database"""
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    async with db_pool.acquire() as conn:
        # Create processing record
        result = await conn.fetchrow("""
            INSERT INTO beta_v2_processing_results (
                source_type, source_id, domain,
                stage1_stripped_text, stage1_processing_time_ms,
                stage2_extracted_data, stage2_model_used, stage2_processing_time_ms,
                stage3_entity_name, stage3_entity_confidence,
                processing_status, created_at, updated_at
            ) VALUES (
                $1, $2, $3,
                $4, $5,
                $6::jsonb, $7, $8,
                $9, $10,
                'completed', NOW(), NOW()
            ) RETURNING id
        """, 
            source_type, source_id, domain,
            extracted_data.get('text', '')[:5000],  # Truncate text
            100,  # Processing time
            json.dumps(extracted_data),
            'fastapi_extractor',
            50,
            extracted_data.get('primary_entity'),
            0.95 if extracted_data.get('primary_entity') else 0.0
        )
        
        return result['id']

async def process_dump_async(source_type: str, source_id: int):
    """Process a dump asynchronously"""
    try:
        logger.info(f"Processing {source_type}:{source_id}")
        
        # Get dump data
        dump_data = await get_dump_data(source_type, source_id)
        if not dump_data:
            logger.error(f"Dump not found: {source_type}:{source_id}")
            return
        
        # Extract HTML content based on source type
        html_content = None
        domain = dump_data.get('domain', '')
        
        if source_type == 'crawlee_dump':
            dump_json = dump_data.get('dump_data', {})
            if isinstance(dump_json, str):
                dump_json = json.loads(dump_json)
            pages = dump_json.get('pages', [])
            if pages:
                html_content = pages[0].get('html', '')
        elif source_type == 'axios_cheerio_dump':
            dump_json = dump_data.get('dump_data', {})
            if isinstance(dump_json, str):
                dump_json = json.loads(dump_json)
            html_content = dump_json.get('html', '')
        
        if not html_content:
            logger.error(f"No HTML content found in dump: {source_type}:{source_id}")
            return
        
        # Extract entities and data
        extractor = EntityExtractor()
        extracted_data = extractor.extract_from_html(html_content, domain)
        
        logger.info(f"Extracted data for {domain}: {extracted_data.get('primary_entity')}")
        
        # Save to database
        processing_id = await save_processing_result(
            source_type, source_id, domain, extracted_data
        )
        
        logger.info(f"Saved processing result: {processing_id}")
        
    except Exception as e:
        logger.error(f"Error processing dump: {e}")

@app.on_event("startup")
async def startup_event():
    """Initialize database on startup"""
    await init_db()

@app.on_event("shutdown")
async def shutdown_event():
    """Close database pool on shutdown"""
    if db_pool:
        await db_pool.close()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "FastAPI Processor"}

@app.post("/process", response_model=ProcessingResponse)
async def process_dump(request: ProcessRequest, background_tasks: BackgroundTasks):
    """Process a dump through the extraction pipeline"""
    
    # Validate request
    if request.source_type not in ['crawlee_dump', 'scrapy_crawl', 'playwright_dump', 'axios_cheerio_dump']:
        raise HTTPException(status_code=400, detail="Invalid source type")
    
    # Add to background tasks for async processing
    background_tasks.add_task(
        process_dump_async,
        request.source_type,
        request.source_id
    )
    
    return ProcessingResponse(
        success=True,
        processing_id=request.source_id,
        message=f"Processing started for {request.source_type}:{request.source_id}"
    )

@app.get("/status/{source_type}/{source_id}")
async def get_processing_status(source_type: str, source_id: int):
    """Get processing status for a specific dump"""
    if not db_pool:
        raise HTTPException(status_code=500, detail="Database not connected")
    
    async with db_pool.acquire() as conn:
        row = await conn.fetchrow("""
            SELECT id, processing_status, stage3_entity_name, created_at
            FROM beta_v2_processing_results
            WHERE source_type = $1 AND source_id = $2
            ORDER BY created_at DESC
            LIMIT 1
        """, source_type, source_id)
        
        if row:
            return {
                "found": True,
                "processing_id": row['id'],
                "status": row['processing_status'],
                "entity": row['stage3_entity_name'],
                "created_at": row['created_at'].isoformat() if row['created_at'] else None
            }
        else:
            return {"found": False}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)