
#!/usr/bin/env python3
"""
FastAPI Analytics Server - Domain Intelligence Platform
Solves GLEIF export aggregation issues and provides enhanced analytics
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from sqlalchemy import create_engine, text, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.ext.declarative import declarative_base
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import json
from datetime import datetime

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(
    title="Domain Intelligence Analytics API", 
    version="2.0.0",
    description="Enhanced analytics and export capabilities for GLEIF data"
)

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic Models
class DomainExportResponse(BaseModel):
    id: int
    domain: str
    company_name: Optional[str]
    extraction_method: Optional[str]
    confidence_score: Optional[float]
    status: str
    guessed_country: Optional[str]
    processing_time_ms: Optional[int]
    
    # GLEIF Enhancement Fields
    gleif_status: Optional[str]
    lei_code: Optional[str]
    business_category: str
    recommendation: str
    
    # Aggregated GLEIF Data
    gleif_candidate_count: int
    all_lei_codes: str
    all_legal_names: str
    all_jurisdictions: str
    all_entity_statuses: str

class ShellAnalysisResponse(BaseModel):
    domain: str
    extracted_company: Optional[str]
    geographic_intelligence: Optional[str]
    lei_candidates: List[Dict[str, Any]]
    analysis: Dict[str, Any]

class BatchPerformanceResponse(BaseModel):
    batch_id: str
    total_domains: int
    success_rate: float
    avg_processing_time: float
    gleif_enrichment_rate: float
    top_performers: List[Dict[str, Any]]

# MAIN EXPORT ENDPOINT - Solves the aggregation issue
@app.get("/export/{batch_id}", response_model=List[DomainExportResponse])
async def export_batch_with_gleif(batch_id: str, db: Session = Depends(get_db)):
    """
    Export batch with GLEIF candidates - solves the JOIN aggregation issue
    that was failing in Express.js + Drizzle ORM implementation
    """
    query = text("""
        SELECT 
            d.id,
            d.domain,
            d.company_name,
            d.extraction_method,
            d.confidence_score,
            d.status,
            d.guessed_country,
            d.processing_time_ms,
            
            -- GLEIF Enhancement Fields
            CASE 
                WHEN d.level2_status = 'success' THEN 'GLEIF Verified'
                WHEN d.level2_status = 'multiple_candidates' THEN 'GLEIF Multiple'
                WHEN d.level2_status = 'failed' THEN 'GLEIF Failed'
                ELSE 'No GLEIF'
            END as gleif_status,
            
            d.primary_lei_code as lei_code,
            
            CASE 
                WHEN d.confidence_score >= 85 THEN 'High Priority'
                WHEN d.confidence_score >= 60 THEN 'Good Target'
                WHEN d.confidence_score >= 30 THEN 'Research Required'
                ELSE 'Manual Review'
            END as business_category,
            
            CASE 
                WHEN d.status = 'failed' THEN 'Retry with Level 2'
                WHEN d.confidence_score < 70 THEN 'GLEIF Enhancement'
                ELSE 'Ready for Analysis'
            END as recommendation,
            
            -- Aggregated GLEIF Data
            COUNT(gc.id) as gleif_candidate_count,
            COALESCE(string_agg(DISTINCT gc.lei_code, '; ' ORDER BY gc.lei_code), '') as all_lei_codes,
            COALESCE(string_agg(DISTINCT gc.legal_name, '; ' ORDER BY gc.legal_name), '') as all_legal_names,
            COALESCE(string_agg(DISTINCT gc.jurisdiction, '; ' ORDER BY gc.jurisdiction), '') as all_jurisdictions,
            COALESCE(string_agg(DISTINCT gc.entity_status, '; ' ORDER BY gc.entity_status), '') as all_entity_statuses
            
        FROM domains d
        LEFT JOIN gleif_candidates gc ON d.id = gc.domain_id
        WHERE d.batch_id = :batch_id
        GROUP BY d.id, d.domain, d.company_name, d.extraction_method, d.confidence_score, 
                 d.status, d.guessed_country, d.processing_time_ms, d.level2_status, d.primary_lei_code
        ORDER BY d.id
    """)
    
    result = db.execute(query, {"batch_id": batch_id}).fetchall()
    
    if not result:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    return [
        DomainExportResponse(
            id=row.id,
            domain=row.domain,
            company_name=row.company_name,
            extraction_method=row.extraction_method,
            confidence_score=row.confidence_score,
            status=row.status,
            guessed_country=row.guessed_country,
            processing_time_ms=row.processing_time_ms,
            gleif_status=row.gleif_status,
            lei_code=row.lei_code,
            business_category=row.business_category,
            recommendation=row.recommendation,
            gleif_candidate_count=row.gleif_candidate_count,
            all_lei_codes=row.all_lei_codes,
            all_legal_names=row.all_legal_names,
            all_jurisdictions=row.all_jurisdictions,
            all_entity_statuses=row.all_entity_statuses
        )
        for row in result
    ]

# SHELL.COM ANALYSIS ENDPOINT
@app.get("/analytics/shell-analysis", response_model=ShellAnalysisResponse)
async def analyze_shell_selection(db: Session = Depends(get_db)):
    """Enhanced shell.com LEI candidate analysis with geographic bias detection"""
    query = text("""
        SELECT 
            d.domain,
            d.company_name,
            d.guessed_country,
            json_agg(
                json_build_object(
                    'lei_code', gc.lei_code,
                    'legal_name', gc.legal_name,
                    'jurisdiction', gc.jurisdiction,
                    'rank_position', gc.rank_position,
                    'weighted_score', gc.weighted_score,
                    'entity_status', gc.entity_status,
                    'selection_reason', gc.selection_reason,
                    'is_primary_selection', gc.is_primary_selection
                ) ORDER BY gc.rank_position
            ) as candidates
        FROM domains d
        LEFT JOIN gleif_candidates gc ON d.id = gc.domain_id
        WHERE d.domain = 'shell.com'
        GROUP BY d.id, d.domain, d.company_name, d.guessed_country
        LIMIT 1
    """)
    
    result = db.execute(query).fetchone()
    
    if not result:
        raise HTTPException(status_code=404, detail="shell.com not found in database")
    
    candidates = result.candidates or []
    
    # Analyze geographic bias
    def analyze_geographic_bias(candidates_list):
        if not candidates_list:
            return {"message": "No candidates to analyze"}
        
        jurisdictions = [c.get('jurisdiction') for c in candidates_list if c.get('jurisdiction')]
        us_entities = len([j for j in jurisdictions if j == 'US'])
        total_entities = len(candidates_list)
        
        return {
            "us_bias_percentage": (us_entities / total_entities * 100) if total_entities > 0 else 0,
            "jurisdiction_distribution": {j: jurisdictions.count(j) for j in set(jurisdictions)},
            "bias_assessment": "High US bias detected" if us_entities > total_entities * 0.6 else "Balanced distribution",
            "multinational_structure": len(set(jurisdictions)) > 2
        }
    
    return ShellAnalysisResponse(
        domain=result.domain,
        extracted_company=result.company_name,
        geographic_intelligence=result.guessed_country,
        lei_candidates=candidates,
        analysis={
            "total_candidates": len(candidates),
            "geographic_bias_assessment": analyze_geographic_bias(candidates),
            "selection_quality": {
                "primary_candidate": next((c for c in candidates if c.get('is_primary_selection')), None),
                "score_distribution": [c.get('weighted_score', 0) for c in candidates],
                "entity_status_breakdown": {
                    status: len([c for c in candidates if c.get('entity_status') == status])
                    for status in set(c.get('entity_status', 'Unknown') for c in candidates)
                }
            }
        }
    )

# BATCH PERFORMANCE ANALYTICS
@app.get("/analytics/batch-performance/{batch_id}", response_model=BatchPerformanceResponse)
async def enhanced_batch_analysis(batch_id: str, db: Session = Depends(get_db)):
    """Performance analysis that works reliably with complex aggregations"""
    query = text("""
        SELECT 
            d.domain,
            d.status,
            d.processing_time_ms,
            COUNT(gc.id) as gleif_candidate_count,
            d.confidence_score,
            d.level2_status
        FROM domains d
        LEFT JOIN gleif_candidates gc ON d.id = gc.domain_id
        WHERE d.batch_id = :batch_id
        GROUP BY d.id, d.domain, d.status, d.processing_time_ms, d.confidence_score, d.level2_status
        ORDER BY d.processing_time_ms DESC NULLS LAST
    """)
    
    results = db.execute(query, {"batch_id": batch_id}).fetchall()
    
    if not results:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    total_domains = len(results)
    successful_domains = len([r for r in results if r.status == "success"])
    gleif_enhanced = len([r for r in results if r.gleif_candidate_count > 0])
    avg_processing_time = sum(r.processing_time_ms or 0 for r in results) / total_domains if total_domains > 0 else 0
    
    return BatchPerformanceResponse(
        batch_id=batch_id,
        total_domains=total_domains,
        success_rate=(successful_domains / total_domains * 100) if total_domains > 0 else 0,
        avg_processing_time=avg_processing_time,
        gleif_enrichment_rate=(gleif_enhanced / total_domains * 100) if total_domains > 0 else 0,
        top_performers=[
            {
                "domain": r.domain,
                "processing_time_ms": r.processing_time_ms,
                "gleif_candidates": r.gleif_candidate_count,
                "confidence_score": r.confidence_score,
                "level2_status": r.level2_status
            }
            for r in results[:10]
        ]
    )

# DOMAIN SEARCH AND ANALYSIS
@app.get("/analytics/domain-search")
async def search_domains(
    query_term: str = Query(..., description="Search term for domain or company name"),
    limit: int = Query(10, description="Maximum number of results"),
    db: Session = Depends(get_db)
):
    """Search domains by name or company with GLEIF enhancement status"""
    search_query = text("""
        SELECT 
            d.domain,
            d.company_name,
            d.confidence_score,
            d.status,
            d.level2_status,
            d.primary_lei_code,
            COUNT(gc.id) as candidate_count
        FROM domains d
        LEFT JOIN gleif_candidates gc ON d.id = gc.domain_id
        WHERE 
            d.domain ILIKE :search_term 
            OR d.company_name ILIKE :search_term
        GROUP BY d.id, d.domain, d.company_name, d.confidence_score, d.status, d.level2_status, d.primary_lei_code
        ORDER BY d.confidence_score DESC NULLS LAST
        LIMIT :limit
    """)
    
    results = db.execute(search_query, {
        "search_term": f"%{query_term}%",
        "limit": limit
    }).fetchall()
    
    return {
        "search_term": query_term,
        "total_results": len(results),
        "domains": [
            {
                "domain": r.domain,
                "company_name": r.company_name,
                "confidence_score": r.confidence_score,
                "status": r.status,
                "gleif_status": r.level2_status,
                "lei_code": r.primary_lei_code,
                "candidate_count": r.candidate_count
            }
            for r in results
        ]
    }

# COMPARATIVE ANALYSIS
@app.get("/analytics/comparison")
async def comparative_analysis(
    batch_ids: str = Query(..., description="Comma-separated batch IDs to compare"),
    db: Session = Depends(get_db)
):
    """Compare performance across multiple batches"""
    batch_list = [bid.strip() for bid in batch_ids.split(',')]
    
    query = text("""
        SELECT 
            d.batch_id,
            COUNT(*) as total_domains,
            COUNT(*) FILTER (WHERE d.status = 'success') as successful_domains,
            AVG(d.confidence_score) as avg_confidence,
            COUNT(*) FILTER (WHERE d.level2_status = 'success') as gleif_verified,
            AVG(d.processing_time_ms) as avg_processing_time
        FROM domains d
        WHERE d.batch_id = ANY(:batch_ids)
        GROUP BY d.batch_id
        ORDER BY d.batch_id
    """)
    
    results = db.execute(query, {"batch_ids": batch_list}).fetchall()
    
    return {
        "compared_batches": batch_list,
        "comparison_data": [
            {
                "batch_id": r.batch_id,
                "total_domains": r.total_domains,
                "success_rate": (r.successful_domains / r.total_domains * 100) if r.total_domains > 0 else 0,
                "avg_confidence": round(r.avg_confidence or 0, 2),
                "gleif_verification_rate": (r.gleif_verified / r.total_domains * 100) if r.total_domains > 0 else 0,
                "avg_processing_time_ms": round(r.avg_processing_time or 0, 2)
            }
            for r in results
        ]
    }

# HEALTH CHECK
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "framework": "FastAPI",
        "database": "PostgreSQL",
        "features": [
            "GLEIF Export Aggregation",
            "Shell.com Analysis",
            "Batch Performance Analytics",
            "Domain Search",
            "Comparative Analysis"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
