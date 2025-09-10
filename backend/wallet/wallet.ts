import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

// Endpoint path constants
const WALLET_PATH = "/wallet/wallets";
const WALLET_BY_ADDRESS_PATH = "/wallet/:address";
const WALLET_BALANCE_PATH = "/wallet/:address/balance";
const WALLET_UPDATE_USAGE_PATH = "/wallet/:address/update-usage";

const walletDB = SQLDatabase.named("blockchain");

// Types
export interface Wallet {
  id: number;
  address: string;
  userId: string;
  walletType: string;
  isCustodial: boolean;
  publicKey?: string;
  createdAt: Date;
  lastUsedAt: Date;
}

export interface CreateWalletRequest {
  address: string;
  userId: string;
  walletType?: string;
  isCustodial?: boolean;
  encryptedPrivateKey?: string;
  publicKey?: string;
}

export interface WalletBalanceItem {
  tokenSymbol: string;
  tokenName: string;
  balance: string;
  decimals: number;
  contractAddress: string;
}

export interface WalletBalanceResponse {
  address: string;
  balances: WalletBalanceItem[];
}

export interface ListWalletsResponse {
  wallets: Wallet[];
}

// Helper for ISO date conversion
function toISODateFields<T extends { createdAt: Date, lastUsedAt: Date }>(obj: T): T & { createdAt: string, lastUsedAt: string } {
  return {
    ...obj,
    createdAt: obj.createdAt?.toISOString(),
    lastUsedAt: obj.lastUsedAt?.toISOString()
  };
}

// List all wallets for a user
export const listWallets = api<{ userId: string }, ListWalletsResponse>(
  { expose: true, method: "GET", path: WALLET_PATH },
  async ({ userId }) => {
    if (!userId) {
      throw api.error("Missing userId", 400);
    }
    const wallets = await walletDB.queryAll<Wallet>`
      SELECT 
        id,
        address,
        user_id as "userId",
        wallet_type as "walletType",
        is_custodial as "isCustodial",
        public_key as "publicKey",
        created_at as "createdAt",
        last_used_at as "lastUsedAt"
      FROM wallets 
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
    `;
    // Format date fields
    return { wallets: wallets.map(toISODateFields) };
  }
);

// Get a specific wallet by address
export const getWallet = api<{ address: string }, Wallet>(
  { expose: true, method: "GET", path: WALLET_BY_ADDRESS_PATH },
  async ({ address }) => {
    if (!address) {
      throw api.error("Missing wallet address", 400);
    }
    const wallet = await walletDB.queryRow<Wallet>`
      SELECT 
        id,
        address,
        user_id as "userId",
        wallet_type as "walletType",
        is_custodial as "isCustodial",
        public_key as "publicKey",
        created_at as "createdAt",
        last_used_at as "lastUsedAt"
      FROM wallets 
      WHERE address = ${address}
    `;
    if (!wallet) {
      throw api.error("Wallet not found", 404);
    }
    return toISODateFields(wallet);
  }
);

// Create a new wallet
export const createWallet = api<CreateWalletRequest, Wallet>(
  { expose: true, method: "POST", path: WALLET_PATH },
  async (req) => {
    // Validate required fields
    if (!req.address || !req.userId) {
      throw api.error("Missing required fields: address or userId", 400);
    }
    // Validate optional: encryptedPrivateKey should be encrypted before arrival
    if (req.encryptedPrivateKey && req.encryptedPrivateKey.length < 32) {
      throw api.error("Encrypted private key is too short or not securely encrypted", 400);
    }
    const wallet = await walletDB.queryRow<Wallet>`
      INSERT INTO wallets (
        address, 
        user_id, 
        wallet_type, 
        is_custodial, 
        encrypted_private_key, 
        public_key
      )
      VALUES (
        ${req.address}, 
        ${req.userId}, 
        ${req.walletType || 'EOA'}, 
        ${req.isCustodial ?? false}, 
        ${req.encryptedPrivateKey || null}, 
        ${req.publicKey || null}
      )
      RETURNING 
        id,
        address,
        user_id as "userId",
        wallet_type as "walletType",
        is_custodial as "isCustodial",
        public_key as "publicKey",
        created_at as "createdAt",
        last_used_at as "lastUsedAt"
    `;
    if (!wallet) {
      throw api.error("Failed to create wallet", 500);
    }
    return toISODateFields(wallet);
  }
);

// Get wallet balances (tokens)
export const getWalletBalance = api<{ address: string }, WalletBalanceResponse>(
  { expose: true, method: "GET", path: WALLET_BALANCE_PATH },
  async ({ address }) => {
    if (!address) {
      throw api.error("Missing wallet address", 400);
    }
    const balances = await walletDB.queryAll<WalletBalanceItem>`
      SELECT 
        t.symbol as "tokenSymbol",
        t.name as "tokenName",
        tb.balance::text as balance,
        t.decimals,
        sc.address as "contractAddress"
      FROM token_balances tb
      JOIN wallets w ON tb.wallet_id = w.id
      JOIN tokens t ON tb.token_id = t.id
      JOIN smart_contracts sc ON t.contract_id = sc.id
      WHERE w.address = ${address}
        AND tb.balance > 0
      ORDER BY t.symbol
    `;
    return {
      address,
      balances
    };
  }
);

// Update wallet last used timestamp
export const updateWalletLastUsed = api<{ address: string }, void>(
  { expose: true, method: "PATCH", path: WALLET_UPDATE_USAGE_PATH },
  async ({ address }) => {
    if (!address) {
      throw api.error("Missing wallet address", 400);
    }
    await walletDB.exec`
      UPDATE wallets 
      SET last_used_at = NOW() 
      WHERE address = ${address}
    `;
  }
);
