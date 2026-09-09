CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'operator', -- admin, operator, viewer
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Devices (robot controllers)
CREATE TABLE devices (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    factory_id VARCHAR(100) NOT NULL,
    hw_model VARCHAR(100) NOT NULL DEFAULT 'sim-v1',
    current_version VARCHAR(50) NOT NULL DEFAULT '0.0.0',
    status VARCHAR(20) NOT NULL DEFAULT 'offline', -- online, offline, updating, error
    last_seen TIMESTAMPTZ,
    ip_address VARCHAR(45),
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Firmware versions
CREATE TABLE firmware_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version VARCHAR(50) UNIQUE NOT NULL,
    storage_key VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL DEFAULT 0,
    sha256_checksum VARCHAR(64) NOT NULL,
    ecdsa_signature TEXT,
    release_notes TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    uploaded_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deployments
CREATE TABLE deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firmware_version_id UUID NOT NULL REFERENCES firmware_versions(id),
    strategy VARCHAR(20) NOT NULL DEFAULT 'full', -- full, canary
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, running, completed, failed, rolled_back
    canary_percentage INT NOT NULL DEFAULT 100,
    current_phase INT NOT NULL DEFAULT 0,
    total_devices INT NOT NULL DEFAULT 0,
    success_count INT NOT NULL DEFAULT 0,
    failure_count INT NOT NULL DEFAULT 0,
    rollback_threshold FLOAT NOT NULL DEFAULT 0.20,
    created_by VARCHAR(100),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-device deployment progress
CREATE TABLE deployment_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
    device_id VARCHAR(100) NOT NULL REFERENCES devices(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, downloading, verifying, installing, success, failed, rolled_back
    progress INT NOT NULL DEFAULT 0,
    error_message TEXT,
    previous_version VARCHAR(50),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Audit log
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id VARCHAR(100),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_devices_factory ON devices(factory_id);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_deployment_devices_deployment ON deployment_devices(deployment_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
