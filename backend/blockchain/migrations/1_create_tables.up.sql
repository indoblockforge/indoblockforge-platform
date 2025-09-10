-- Networks table for managing different blockchain networks
CREATE TABLE networks (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  chain_id INTEGER NOT NULL UNIQUE,
  rpc_url TEXT NOT NULL,
  explorer_url TEXT,
  native_currency VARCHAR(10) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Smart contracts table
CREATE TABLE smart_contracts (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address VARCHAR(42) NOT NULL,
  network_id BIGINT NOT NULL REFERENCES networks(id),
  abi TEXT NOT NULL,
  bytecode TEXT,
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
  contract_type VARCHAR(50) NOT NULL, -- could be ENUM if DB supports
  is_verified BOOLEAN NOT NULL DEFAULT false,
  deployed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deployed_by VARCHAR(255), -- refactor: match user_id type
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(address, network_id)
);

-- Wallets table for user wallet management
CREATE TABLE wallets (
  id BIGSERIAL PRIMARY KEY,
  address VARCHAR(42) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  wallet_type VARCHAR(20) NOT NULL DEFAULT 'EOA',
  is_custodial BOOLEAN NOT NULL DEFAULT false,
  encrypted_private_key TEXT,
  public_key TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CHECK (is_custodial OR encrypted_private_key IS NULL)
);

CREATE INDEX idx_wallets_user_id ON wallets(user_id);

-- Tokens table for managing all tokens
CREATE TABLE tokens (
  id BIGSERIAL PRIMARY KEY,
  contract_id BIGINT NOT NULL REFERENCES smart_contracts(id),
  symbol VARCHAR(20) NOT NULL,
  name VARCHAR(255) NOT NULL,
  decimals INTEGER NOT NULL DEFAULT 18,
  total_supply DECIMAL(78, 0),
  max_supply DECIMAL(78, 0),
  token_type VARCHAR(20) NOT NULL,
  metadata_uri TEXT,
  is_mintable BOOLEAN NOT NULL DEFAULT true,
  is_burnable BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(contract_id, symbol)
);

CREATE INDEX idx_tokens_symbol ON tokens(symbol);

-- Token balances table
CREATE TABLE token_balances (
  id BIGSERIAL PRIMARY KEY,
  wallet_id BIGINT NOT NULL REFERENCES wallets(id),
  token_id BIGINT NOT NULL REFERENCES tokens(id),
  balance DECIMAL(78, 0) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(wallet_id, token_id)
);

CREATE INDEX idx_token_balances_wallet_id ON token_balances(wallet_id);

-- Transactions table for tracking all blockchain transactions
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed');
CREATE TYPE transaction_type AS ENUM ('transfer', 'contract_call', 'contract_deploy');

CREATE TABLE transactions (
  id BIGSERIAL PRIMARY KEY,
  hash VARCHAR(66) NOT NULL UNIQUE,
  network_id BIGINT NOT NULL REFERENCES networks(id),
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42),
  value DECIMAL(78, 0) NOT NULL DEFAULT 0,
  gas_price DECIMAL(78, 0),
  gas_limit BIGINT,
  gas_used BIGINT,
  nonce BIGINT,
  block_number BIGINT,
  block_hash VARCHAR(66),
  transaction_index INTEGER,
  status transaction_status NOT NULL DEFAULT 'pending',
  transaction_type transaction_type NOT NULL,
  contract_address VARCHAR(42),
  logs JSONB, -- refactor: use JSONB
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  confirmed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_transactions_network_id ON transactions(network_id);

-- NFT metadata table for storing NFT-specific data
CREATE TABLE nft_metadata (
  id BIGSERIAL PRIMARY KEY,
  token_id BIGINT NOT NULL REFERENCES tokens(id),
  token_number DECIMAL(78, 0) NOT NULL,
  name VARCHAR(255),
  description TEXT,
  image_url TEXT,
  animation_url TEXT,
  external_url TEXT,
  attributes JSONB, -- refactor: use JSONB
  owner_address VARCHAR(42),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(token_id, token_number)
);

-- API keys table for rate limiting and access control
CREATE TABLE api_keys (
  id BIGSERIAL PRIMARY KEY,
  key_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  permissions JSONB NOT NULL, -- refactor: use JSONB
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);

-- Events table for blockchain event logging
CREATE TABLE blockchain_events (
  id BIGSERIAL PRIMARY KEY,
  transaction_hash VARCHAR(66) NOT NULL,
  contract_address VARCHAR(42) NOT NULL,
  event_name VARCHAR(255) NOT NULL,
  event_data JSONB NOT NULL,
  block_number BIGINT NOT NULL,
  log_index INTEGER NOT NULL,
  network_id BIGINT NOT NULL REFERENCES networks(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Marketplace listings for NFT trading
CREATE TYPE listing_status AS ENUM ('active', 'sold', 'cancelled', 'expired');
CREATE TABLE marketplace_listings (
  id BIGSERIAL PRIMARY KEY,
  token_id BIGINT NOT NULL REFERENCES tokens(id),
  token_number DECIMAL(78, 0) NOT NULL,
  seller_address VARCHAR(42) NOT NULL,
  price DECIMAL(78, 0) NOT NULL,
  currency_token_id BIGINT REFERENCES tokens(id),
  status listing_status NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sold_at TIMESTAMP WITH TIME ZONE,
  buyer_address VARCHAR(42)
);

CREATE INDEX idx_marketplace_token_id ON marketplace_listings(token_id);
CREATE INDEX idx_marketplace_seller ON marketplace_listings(seller_address);
CREATE INDEX idx_marketplace_status ON marketplace_listings(status);

-- Create indexes for blockchain_events table
CREATE INDEX idx_events_contract_name ON blockchain_events (contract_address, event_name);
CREATE INDEX idx_events_block ON blockchain_events (block_number);
CREATE INDEX idx_events_tx ON blockchain_events (transaction_hash);

-- Insert default networks
INSERT INTO networks (name, chain_id, rpc_url, explorer_url, native_currency) VALUES
('Ethereum Mainnet', 1, 'https://mainnet.infura.io/v3/YOUR_PROJECT_ID', 'https://etherscan.io', 'ETH'),
('Polygon Mainnet', 137, 'https://polygon-rpc.com', 'https://polygonscan.com', 'MATIC'),
('BSC Mainnet', 56, 'https://bsc-dataseed.binance.org', 'https://bscscan.com', 'BNB'),
('Ethereum Sepolia', 11155111, 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID', 'https://sepolia.etherscan.io', 'ETH'),
('Polygon Mumbai', 80001, 'https://rpc-mumbai.maticvigil.com', 'https://mumbai.polygonscan.com', 'MATIC');
