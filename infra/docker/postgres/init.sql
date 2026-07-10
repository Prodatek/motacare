-- ============================================================
-- MOTACARE — PostgreSQL Initialization
-- Runs once on first container start (empty data volume).
-- Creates all service databases and grants privileges.
--
-- REPLACE infra/docker/postgres/init.sql with this file.
-- ============================================================

-- Phase 1
CREATE DATABASE motacare_auth;
CREATE DATABASE motacare_vehicles;
CREATE DATABASE motacare_inspections;

-- Phase 2
CREATE DATABASE motacare_fixjobs;
CREATE DATABASE motacare_subscriptions;

-- Phase 3
CREATE DATABASE motacare_workshops;

-- Phase 4
CREATE DATABASE motacare_crm;

-- Grant all privileges to the app user
GRANT ALL PRIVILEGES ON DATABASE motacare_auth          TO motacare;
GRANT ALL PRIVILEGES ON DATABASE motacare_vehicles      TO motacare;
GRANT ALL PRIVILEGES ON DATABASE motacare_inspections   TO motacare;
GRANT ALL PRIVILEGES ON DATABASE motacare_fixjobs       TO motacare;
GRANT ALL PRIVILEGES ON DATABASE motacare_subscriptions TO motacare;
GRANT ALL PRIVILEGES ON DATABASE motacare_workshops     TO motacare;
GRANT ALL PRIVILEGES ON DATABASE motacare_crm           TO motacare;