# Original Project Specification: Domain-to-Company Name Extractor

*Date: June 23, 2025*  
*Document Type: Initial Project Blueprint*  
*Status: Historical Document - Preserved for Reference*

---

## Historical Context

This document represents the very first specification for what would eventually become the Domain Intelligence Platform. Originally conceived as a simple web scraper to extract company names from domains, the project has evolved into a sophisticated business intelligence system solving the complex problem of domain-to-entity mapping.

---

## **Project: Domain-to-Company Name Extractor**

### **🎯 Project Overview**
Build a production-scale system to extract company names from 1 million domains using distributed architecture and web scraping.

---

## **📋 Task Breakdown**

### **Task 1: Setup Infrastructure**
```bash
# Create project structure
mkdir domain-scraper
cd domain-scraper
mkdir src tests config docker
touch requirements.txt docker-compose.yml
```

**Deliverables:**
- Docker containers configured
- Redis message queue running
- PostgreSQL database initialized
- Basic project structure created

---

### **Task 2: Database Schema**
```sql
-- File: config/schema.sql
CREATE TABLE domains (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    company_name VARCHAR(500),
    extraction_method VARCHAR(100),
    confidence_score FLOAT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    processed_at TIMESTAMP
);

CREATE INDEX idx_domains_status ON domains(status);
CREATE INDEX idx_domains_domain ON domains(domain);
```

**Deliverables:**
- Database tables created
- Indexes optimized for queries
- Connection pooling configured

---

### **Task 3: Core Scraper Module**
```python
# File: src/scraper.py
import requests
from bs4 import BeautifulSoup
import re
from typing import Optional

class CompanyNameExtractor:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        })
    
    def extract_company_name(self, domain: str) -> Optional[str]:
        # Implementation here
        pass
```

**Deliverables:**
- Web scraping functionality
- HTML parsing for company names
- Fallback domain parsing logic
- Error handling with retries

---

### **Task 4: Message Queue System**
```python
# File: src/queue_manager.py
import redis
import json
from typing import List

class QueueManager:
    def __init__(self, redis_host='localhost', redis_port=6379):
        self.redis_client = redis.Redis(host=redis_host, port=redis_port)
    
    def add_domains(self, domains: List[str]):
        # Add domains to processing queue
        pass
    
    def get_batch(self, batch_size=1000) -> List[str]:
        # Get batch of domains for processing
        pass
```

**Deliverables:**
- Redis queue implementation
- Batch processing logic
- Dead letter queue for failures
- Queue monitoring capabilities

---

### **Task 5: Worker Node**
```python
# File: src/worker.py
import concurrent.futures
from typing import List
import time

class DomainWorker:
    def __init__(self, worker_id: str):
        self.worker_id = worker_id
        self.extractor = CompanyNameExtractor()
        self.queue_manager = QueueManager()
    
    def process_batch(self, domains: List[str]):
        with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
            # Process domains in parallel
            pass
    
    def run(self):
        # Main worker loop
        while True:
            batch = self.queue_manager.get_batch()
            if batch:
                self.process_batch(batch)
            time.sleep(1)
```

**Deliverables:**
- Parallel processing implementation
- Worker health monitoring
- Result storage to database
- Graceful shutdown handling

---

### **Task 6: Master Coordinator**
```python
# File: src/coordinator.py
class MasterCoordinator:
    def __init__(self):
        self.queue_manager = QueueManager()
        self.db_manager = DatabaseManager()
    
    def load_domains(self, file_path: str):
        # Load 1M domains from file
        pass
    
    def monitor_progress(self):
        # Track processing progress
        pass
    
    def scale_workers(self):
        # Auto-scale based on queue depth
        pass
```

**Deliverables:**
- Domain ingestion system
- Progress monitoring dashboard
- Auto-scaling logic
- Performance metrics collection

---

### **Task 7: Docker Configuration**
```yaml
# File: docker-compose.yml
version: '3.8'
services:
  redis:
    image: redis:alpine
    ports:
      - "6379:6379"
  
  postgres:
    image: postgres:13
    environment:
      POSTGRES_DB: domain_scraper
      POSTGRES_USER: scraper
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
  
  worker:
    build: .
    command: python src/worker.py
    depends_on:
      - redis
      - postgres
    scale: 5
```

**Deliverables:**
- Multi-container setup
- Service orchestration
- Environment configuration
- Scaling capabilities

---

### **Task 8: Testing Suite**
```python
# File: tests/test_scraper.py
import pytest
from src.scraper import CompanyNameExtractor

def test_extract_from_title():
    # Test company name extraction from title tags
    pass

def test_domain_parsing_fallback():
    # Test domain-to-company parsing
    pass

def test_batch_processing():
    # Test worker batch processing
    pass
```

**Deliverables:**
- Unit tests for all modules
- Integration tests
- Load testing scripts
- Performance benchmarks

---

### **Task 9: Monitoring & Logging**
```python
# File: src/monitoring.py
import logging
import prometheus_client

class MetricsCollector:
    def __init__(self):
        self.processed_counter = prometheus_client.Counter('domains_processed_total')
        self.success_rate = prometheus_client.Gauge('extraction_success_rate')
    
    def record_processing(self, success: bool):
        # Record metrics
        pass
```

**Deliverables:**
- Prometheus metrics
- Structured logging
- Performance dashboards
- Alert configurations

---

### **Task 10: Production Deployment**
```bash
# File: deploy.sh
#!/bin/bash
docker-compose up -d --scale worker=10
python src/coordinator.py --load-domains domains.txt
python src/monitor.py
```

**Deliverables:**
- Production deployment scripts
- Environment configurations
- Backup procedures
- Operational runbooks

---

## **🚀 Execution Order**
1. Tasks 1-2: Infrastructure (Day 1-2)
2. Tasks 3-4: Core functionality (Day 3-5)
3. Tasks 5-6: Processing pipeline (Day 6-8)
4. Tasks 7-8: Containerization & testing (Day 9-10)
5. Tasks 9-10: Monitoring & deployment (Day 11-12)

**Expected Output:** System capable of processing 1M domains in 24-48 hours with 85%+ accuracy rate.

---

## Evolution Note

This original specification has evolved significantly. What started as a simple web scraper has transformed into:

1. **From Simple Scraping to Intelligence Platform**: The project now uses federated microservices (Playwright, Scrapy, Crawlee, Axios+Cheerio) instead of just BeautifulSoup
2. **From 1:1 to 1:Many Mapping**: Recognition that domains map to multiple valid entities, not just one company name
3. **From Basic Extraction to GLEIF Verification**: Integration with the Global Legal Entity Identifier Foundation for authoritative entity data
4. **From Redis Queues to PostgreSQL-Centric**: Full reliance on PostgreSQL for persistence and cross-batch intelligence
5. **From Docker to Replit Native**: Adapted to run natively on Replit's infrastructure
6. **From Simple Parsing to LLM Enhancement**: Integration of AI models for intelligent extraction and arbitration
7. **From Technical Tool to Business Solution**: Focus shifted to solving the complex business problem of domain-to-entity mapping

The core vision of processing domains at scale remains, but the solution has matured into a comprehensive business intelligence platform.