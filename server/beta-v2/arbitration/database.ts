import { db } from '../database';

export class ArbitrationDatabase {
  async initializeTables() {
    console.log('[Beta v2] [Arbitration] Initializing arbitration tables...');

    // Create arbitration_requests table
    await db.query(`
      CREATE TABLE IF NOT EXISTS arbitration_requests (
        id SERIAL PRIMARY KEY,
        domain TEXT NOT NULL,
        dump_id INTEGER,
        collection_type TEXT,
        status TEXT CHECK (status IN ('pending', 'processing', 'completed', 'failed')) DEFAULT 'pending',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create arbitration_claims table
    await db.query(`
      CREATE TABLE IF NOT EXISTS arbitration_claims (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES arbitration_requests(id) ON DELETE CASCADE,
        claim_number INTEGER, -- 0 for LLM, 1-N for GLEIF
        claim_type TEXT CHECK (claim_type IN ('llm_extracted', 'gleif_candidate')),
        entity_name TEXT NOT NULL,
        lei_code TEXT,
        confidence_score FLOAT,
        source TEXT, -- extraction source (title, meta, content, gleif)
        metadata JSONB, -- additional claim data
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create arbitration_results table
    await db.query(`
      CREATE TABLE IF NOT EXISTS arbitration_results (
        id SERIAL PRIMARY KEY,
        request_id INTEGER REFERENCES arbitration_requests(id) ON DELETE CASCADE,
        ranked_entities JSONB[], -- top 5 entities
        arbitrator_model TEXT,
        arbitration_reasoning TEXT,
        processing_time_ms INTEGER,
        perplexity_citations JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create user_bias_profiles table
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_bias_profiles (
        id SERIAL PRIMARY KEY,
        profile_name TEXT NOT NULL,
        user_id TEXT,
        jurisdiction_primary TEXT,
        jurisdiction_secondary TEXT[],
        prefer_parent BOOLEAN DEFAULT true,
        parent_weight FLOAT DEFAULT 0.4,
        jurisdiction_weight FLOAT DEFAULT 0.3,
        entity_status_weight FLOAT DEFAULT 0.1,
        legal_form_weight FLOAT DEFAULT 0.05,
        recency_weight FLOAT DEFAULT 0.05,
        industry_focus JSONB,
        is_default BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create GLEIF relationships cache table
    await db.query(`
      CREATE TABLE IF NOT EXISTS gleif_relationships_cache (
        id SERIAL PRIMARY KEY,
        lei_code TEXT UNIQUE NOT NULL,
        parent_lei TEXT,
        ultimate_parent_lei TEXT,
        relationship_type TEXT,
        relationship_status TEXT,
        relationship_data JSONB,
        cached_at TIMESTAMP DEFAULT NOW(),
        expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '7 days'
      )
    `);

    // Create indices for better performance
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_arbitration_requests_domain ON arbitration_requests(domain);
      CREATE INDEX IF NOT EXISTS idx_arbitration_requests_status ON arbitration_requests(status);
      CREATE INDEX IF NOT EXISTS idx_arbitration_claims_request_id ON arbitration_claims(request_id);
      CREATE INDEX IF NOT EXISTS idx_arbitration_claims_lei_code ON arbitration_claims(lei_code);
      CREATE INDEX IF NOT EXISTS idx_arbitration_results_request_id ON arbitration_results(request_id);
      CREATE INDEX IF NOT EXISTS idx_user_bias_profiles_default ON user_bias_profiles(is_default);
      CREATE INDEX IF NOT EXISTS idx_gleif_relationships_cache_lei ON gleif_relationships_cache(lei_code);
      CREATE INDEX IF NOT EXISTS idx_gleif_relationships_cache_expires ON gleif_relationships_cache(expires_at);
    `);

    // Insert default user bias profile
    await db.query(`
      INSERT INTO user_bias_profiles (
        profile_name, 
        jurisdiction_primary, 
        jurisdiction_secondary, 
        prefer_parent,
        parent_weight,
        jurisdiction_weight,
        is_default
      ) 
      VALUES (
        'Default US Acquisition', 
        'US', 
        ARRAY['GB', 'CA'], 
        true,
        0.4,
        0.3,
        true
      )
      ON CONFLICT DO NOTHING
    `);

    console.log('[Beta v2] [Arbitration] Arbitration tables initialized successfully');
  }
}

export const arbitrationDb = new ArbitrationDatabase();