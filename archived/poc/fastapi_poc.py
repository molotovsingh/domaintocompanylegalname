#!/usr/bin/env python3
"""
FastAPI Proof of Concept - GLEIF Export Solution
Demonstrates how FastAPI + SQLAlchemy solves the database aggregation issues
"""

from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship, joinedload
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

load_dotenv()

# Database setup
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/db")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# SQLAlchemy Models
class Domain(Base):
    __tablename__ = "domains"
    
    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String, index=True)
    batch_id = Column(String, index=True)
    company_name = Column(String, nullable=True)
    extraction_method = Column(String, nullable=True)
    confidence_score = Column(Integer, nullable=True)
    status = Column(String)
    guessed_country = Column(String, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    
    # Relationship to GLEIF candidates
    gleif_candidates = relationship("GleifCandidate", back_populates="domain")

class GleifCandidate(Base):
    __tablename__ = "gleif_candidates"
    
    id = Column(Integer, primary_key=True, index=True)
    domain_id = Column(Integer, ForeignKey("domains.id"))
    lei_code = Column(String)
    legal_name = Column(String)
    jurisdiction = Column(String, nullable=True)
    entity_status = Column(String, nullable=True)
    rank_position = Column(Integer)
    
    # Relationship back to domain
    domain = relationship("Domain", back_populates="gleif_candidates")

# Pydantic Models for API responses
class GleifCandidateResponse(BaseModel):
    lei_code: str
    legal_name: str
    jurisdiction: Optional[str]
    entity_status: Optional[str]
    
    class Config:
        from_attributes = True

class DomainExportResponse(BaseModel):
    domain: str
    company_name: Optional[str]
    extraction_method: Optional[str]
    confidence_score: Optional[int]
    status: str
    guessed_country: Optional[str]
    processing_time_ms: Optional[int]
    gleif_candidate_count: int
    all_lei_codes: str
    all_legal_names: str
    all_jurisdictions: str
    all_entity_statuses: str

# FastAPI app
app = FastAPI(title="Domain Intelligence API", version="2.0.0")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# The endpoint that solves our aggregation problem
@app.get("/export/{batch_id}", response_model=List[DomainExportResponse])
async def export_batch_with_gleif(batch_id: str, db: Session = Depends(get_db)):
    """
    Export batch with GLEIF candidates - solves the JOIN aggregation issue
    that was failing in Express.js implementation
    """
    # SQLAlchemy handles the complex JOIN automatically with eager loading
    domains = db.query(Domain).filter(
        Domain.batch_id == batch_id
    ).options(
        joinedload(Domain.gleif_candidates)
    ).all()
    
    if not domains:
        raise HTTPException(status_code=404, detail="Batch not found")
    
    # Simple list comprehension - no complex aggregation syntax needed
    return [
        DomainExportResponse(
            domain=domain.domain,
            company_name=domain.company_name,
            extraction_method=domain.extraction_method,
            confidence_score=domain.confidence_score,
            status=domain.status,
            guessed_country=domain.guessed_country,
            processing_time_ms=domain.processing_time_ms,
            gleif_candidate_count=len(domain.gleif_candidates),
            all_lei_codes="; ".join([c.lei_code for c in domain.gleif_candidates]),
            all_legal_names="; ".join([c.legal_name for c in domain.gleif_candidates]),
            all_jurisdictions="; ".join([c.jurisdiction or "" for c in domain.gleif_candidates]),
            all_entity_statuses="; ".join([c.entity_status or "" for c in domain.gleif_candidates])
        )
        for domain in domains
    ]

@app.get("/domains/{domain_id}/candidates", response_model=List[GleifCandidateResponse])
async def get_domain_candidates(domain_id: int, db: Session = Depends(get_db)):
    """Get GLEIF candidates for a specific domain"""
    candidates = db.query(GleifCandidate).filter(
        GleifCandidate.domain_id == domain_id
    ).order_by(GleifCandidate.rank_position).all()
    
    return candidates

@app.get("/export/{batch_id}/performance")
async def export_performance_comparison(batch_id: str, db: Session = Depends(get_db)):
    """
    Performance comparison endpoint showing why FastAPI is better
    for complex queries
    """
    # Single optimized query with aggregation
    result = db.query(
        Domain.domain,
        func.count(GleifCandidate.id).label('candidate_count'),
        func.string_agg(GleifCandidate.lei_code, '; ').label('all_lei_codes')
    ).outerjoin(GleifCandidate).filter(
        Domain.batch_id == batch_id
    ).group_by(Domain.id, Domain.domain).all()
    
    return {
        "total_domains": len(result),
        "query_type": "Single optimized SQL with aggregation",
        "performance": "Much faster than N+1 queries",
        "sample_data": [
            {
                "domain": r.domain,
                "candidate_count": r.candidate_count,
                "lei_codes_preview": r.all_lei_codes[:100] + "..." if r.all_lei_codes and len(r.all_lei_codes) > 100 else r.all_lei_codes
            }
            for r in result[:5]
        ]
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "framework": "FastAPI", "database": "PostgreSQL"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)