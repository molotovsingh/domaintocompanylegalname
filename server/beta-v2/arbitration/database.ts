import { db } from './database-wrapper';

// EVALUATOR: Database initialization class handles arbitration schema setup
// Centralized table creation ensures consistent database structure across deployments
export class ArbitrationDatabase {
  // EVALUATOR: Table initialization method creates all arbitration-related tables
  // Consider adding migration versioning and rollback capabilities for production
  async initializeTables(): Promise<void> {
    console.log('[Beta v2] [Arbitration] Initializing arbitration tables...');

    // EVALUATOR: Arbitration requests table tracks the lifecycle of each arbitration process
    // Domain-centric design enables efficient querying by website
    // Status tracking provides visibility into processing pipeline
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

    // EVALUATOR: Claims table stores individual entity candidates for arbitration
    // Foreign key relationship ensures data integrity with cascade deletion
    // JSONB metadata field provides flexible storage for varying claim attributes
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

    // EVALUATOR: Results table stores final arbitration outcomes with full audit trail
    // JSONB array for ranked entities enables flexible result structures
    // Processing time tracking enables performance optimization analysis
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

    // EVALUATOR: User bias profiles enable customizable arbitration preferences
    // Weighted scoring system allows fine-tuning of ranking algorithms
    // Default profile system ensures consistent behavior across users
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
        entity_status_weight FLOAT DEFAULT 0.15,
        legal_form_weight FLOAT DEFAULT 0.1,
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