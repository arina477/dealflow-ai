-- PostgreSQL initialization for Twenty CRM
-- Ensures pgvector extension is available for AI embeddings

-- Create pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant all privileges to the application user
-- (Schema + extension privileges are inherited from database-level grants)
GRANT ALL PRIVILEGES ON SCHEMA public TO twenty_user;
