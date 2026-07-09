-- Migration 0021 DOWN — drop the self-serve firm workspace bootstrap function
DROP FUNCTION IF EXISTS create_firm_workspace(text, text, text);
