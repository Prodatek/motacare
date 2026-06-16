-- ==============================================
-- MOTACARE — PostgreSQL Initialization
-- Runs once on first container start
-- Creates a dedicated DB per service
-- ==============================================

-- Auth Service Database
CREATE DATABASE motacare_auth;
GRANT ALL PRIVILEGES ON DATABASE motacare_auth TO motacare;

-- Vehicle Service Database
CREATE DATABASE motacare_vehicles;
GRANT ALL PRIVILEGES ON DATABASE motacare_vehicles TO motacare;

-- Inspection Service Database
CREATE DATABASE motacare_inspections;
GRANT ALL PRIVILEGES ON DATABASE motacare_inspections TO motacare;

-- Fix Jobs Service Database
CREATE DATABASE motacare_fixjobs;
GRANT ALL PRIVILEGES ON DATABASE motacare_fixjobs TO motacare;

-- Subscription Service Database
CREATE DATABASE motacare_subscriptions;
GRANT ALL PRIVILEGES ON DATABASE motacare_subscriptions TO motacare;

-- Confirm
\echo '✅ Motacare databases created successfully'