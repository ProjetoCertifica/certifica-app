-- Add logo_url column to clientes table
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS logo_url TEXT;
