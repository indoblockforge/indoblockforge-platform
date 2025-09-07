import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const tokenDB = SQLDatabase.named("blockchain");

export interface Token {
  id: number;
  contractId: number;
  symbol: string;
  name: string;
  decimals: number;
  totalSupply?: string;
  maxSupply?: string;
  tokenType: string;
  metadataUri?: string;
  isMintable: boolean;
  isBurnable: boolean;
  createdAt: Date;
  contractAddress?: string;
  networkId?: number;
}

export interface CreateTokenRequest {
  contractId: number;
  symbol: string;
  name: string;
  decimals?: number;
  totalSupply?: string;
  maxSupply?: string;
  tokenType: string;
  metadataUri?: string;
  isMintable?: boolean;
  isBurnable?: boolean;
}

export interface MintTokenRequest {
  tokenId: number;
  toAddress: string;
  amount: string;
}

export interface BurnTokenRequest {
  tokenId: number;
  fromAddress: string;
  amount: string;
}

export interface TransferTokenRequest {
  tokenId: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
}

export interface ListTokensResponse {
  tokens: Token[];
}

export interface TokenOperation {
  success: boolean;
  transactionHash?: string;
  message: string;
}

// List all tokens
export const listTokens = api<void, ListTokensResponse>(
  { expose: true, method: "GET", path: "/token/tokens" },
  async () => {
    const tokens = await tokenDB.queryAll<Token>`
      SELECT 
        t.id,
        t.contract_id as "contractId",
        t.symbol,
        t.name,
        t.decimals,
        t.total_supply::text as "totalSupply",
        t.max_supply::text as "maxSupply",
        t.token_type as "tokenType",
        t.metadata_uri as "metadataUri",
        t.is_mintable as "isMintable",
        t.is_burnable as "isBurnable",
        t.created_at as "createdAt",
        sc.address as "contractAddress",
        sc.network_id as "networkId"
      FROM tokens t
      JOIN smart_contracts sc ON t.contract_id = sc.id
      ORDER BY t.created_at DESC
    `;
    
    return { tokens };
  }
);

// Get a specific token by ID
export const getToken = api<{ id: number }, Token>(
  { expose: true, method: "GET", path: "/token/tokens/:id" },
  async ({ id }) => {
    const token = await tokenDB.queryRow<Token>`
      SELECT 
        t.id,
        t.contract_id as "contractId",
        t.symbol,
        t.name,
        t.decimals,
        t.total_supply::text as "totalSupply",
        t.max_supply::text as "maxSupply",
        t.token_type as "tokenType",
        t.metadata_uri as "metadataUri",
        t.is_mintable as "isMintable",
        t.is_burnable as "isBurnable",
        t.created_at as "createdAt",
        sc.address as "contractAddress",
        sc.network_id as "networkId"
      FROM tokens t
      JOIN smart_contracts sc ON t.contract_id = sc.id
      WHERE t.id = ${id}
    `;
    
    if (!token) {
      throw new Error("Token not found");
    }
    
    return token;
  }
);

// Create a new token
export const createToken = api<CreateTokenRequest, Token>(
  { expose: true, method: "POST", path: "/token/tokens" },
  async (req) => {
    const token = await tokenDB.queryRow<Token>`
      INSERT INTO tokens (
        contract_id,
        symbol,
        name,
        decimals,
        total_supply,
        max_supply,
        token_type,
        metadata_uri,
        is_mintable,
        is_burnable
      )
      VALUES (
        ${req.contractId},
        ${req.symbol},
        ${req.name},
        ${req.decimals || 18},
        ${req.totalSupply || null},
        ${req.maxSupply || null},
        ${req.tokenType},
        ${req.metadataUri || null},
        ${req.isMintable || true},
        ${req.isBurnable || true}
      )
      RETURNING 
        id,
        contract_id as "contractId",
        symbol,
        name,
        decimals,
        total_supply::text as "totalSupply",
        max_supply::text as "maxSupply",
        token_type as "tokenType",
        metadata_uri as "metadataUri",
        is_mintable as "isMintable",
        is_burnable as "isBurnable",
        created_at as "createdAt"
    `;
    
    return token!;
  }
);

// Mint tokens (simulated - in real implementation this would interact with blockchain)
export const mintToken = api<MintTokenRequest, TokenOperation>(
  { expose: true, method: "POST", path: "/token/mint" },
  async (req) => {
    // In a real implementation, this would:
    // 1. Validate the token exists and is mintable
    // 2. Call the smart contract mint function
    // 3. Wait for transaction confirmation
    // 4. Update the database with new balance
    
    // For now, we'll simulate by updating the token balance
    const token = await tokenDB.queryRow`
      SELECT id, is_mintable FROM tokens WHERE id = ${req.tokenId}
    `;
    
    if (!token) {
      throw new Error("Token not found");
    }
    
    if (!token.is_mintable) {
      throw new Error("Token is not mintable");
    }

    // Get or create wallet
    let wallet = await tokenDB.queryRow`
      SELECT id FROM wallets WHERE address = ${req.toAddress}
    `;
    
    if (!wallet) {
      wallet = await tokenDB.queryRow`
        INSERT INTO wallets (address, user_id, wallet_type)
        VALUES (${req.toAddress}, 'system', 'EOA')
        RETURNING id
      `;
    }

    // Update or create token balance
    await tokenDB.exec`
      INSERT INTO token_balances (wallet_id, token_id, balance)
      VALUES (${wallet!.id}, ${req.tokenId}, ${req.amount})
      ON CONFLICT (wallet_id, token_id)
      DO UPDATE SET balance = token_balances.balance + ${req.amount}, updated_at = NOW()
    `;

    // In real implementation, this would be the actual transaction hash
    const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);

    return {
      success: true,
      transactionHash: mockTxHash,
      message: `Successfully minted ${req.amount} tokens to ${req.toAddress}`
    };
  }
);

// Burn tokens (simulated)
export const burnToken = api<BurnTokenRequest, TokenOperation>(
  { expose: true, method: "POST", path: "/token/burn" },
  async (req) => {
    const token = await tokenDB.queryRow`
      SELECT id, is_burnable FROM tokens WHERE id = ${req.tokenId}
    `;
    
    if (!token) {
      throw new Error("Token not found");
    }
    
    if (!token.is_burnable) {
      throw new Error("Token is not burnable");
    }

    // Get wallet and check balance
    const balance = await tokenDB.queryRow`
      SELECT tb.balance, w.id as wallet_id
      FROM token_balances tb
      JOIN wallets w ON tb.wallet_id = w.id
      WHERE w.address = ${req.fromAddress} AND tb.token_id = ${req.tokenId}
    `;
    
    if (!balance || BigInt(balance.balance) < BigInt(req.amount)) {
      throw new Error("Insufficient balance to burn");
    }

    // Update token balance
    await tokenDB.exec`
      UPDATE token_balances 
      SET balance = balance - ${req.amount}, updated_at = NOW()
      WHERE wallet_id = ${balance.wallet_id} AND token_id = ${req.tokenId}
    `;

    const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);

    return {
      success: true,
      transactionHash: mockTxHash,
      message: `Successfully burned ${req.amount} tokens from ${req.fromAddress}`
    };
  }
);

// Transfer tokens (simulated)
export const transferToken = api<TransferTokenRequest, TokenOperation>(
  { expose: true, method: "POST", path: "/token/transfer" },
  async (req) => {
    // Get from wallet and check balance
    const fromBalance = await tokenDB.queryRow`
      SELECT tb.balance, w.id as wallet_id
      FROM token_balances tb
      JOIN wallets w ON tb.wallet_id = w.id
      WHERE w.address = ${req.fromAddress} AND tb.token_id = ${req.tokenId}
    `;
    
    if (!fromBalance || BigInt(fromBalance.balance) < BigInt(req.amount)) {
      throw new Error("Insufficient balance to transfer");
    }

    // Get or create to wallet
    let toWallet = await tokenDB.queryRow`
      SELECT id FROM wallets WHERE address = ${req.toAddress}
    `;
    
    if (!toWallet) {
      toWallet = await tokenDB.queryRow`
        INSERT INTO wallets (address, user_id, wallet_type)
        VALUES (${req.toAddress}, 'system', 'EOA')
        RETURNING id
      `;
    }

    // Start transaction
    await tokenDB.exec`BEGIN`;
    
    try {
      // Deduct from sender
      await tokenDB.exec`
        UPDATE token_balances 
        SET balance = balance - ${req.amount}, updated_at = NOW()
        WHERE wallet_id = ${fromBalance.wallet_id} AND token_id = ${req.tokenId}
      `;

      // Add to receiver
      await tokenDB.exec`
        INSERT INTO token_balances (wallet_id, token_id, balance)
        VALUES (${toWallet!.id}, ${req.tokenId}, ${req.amount})
        ON CONFLICT (wallet_id, token_id)
        DO UPDATE SET balance = token_balances.balance + ${req.amount}, updated_at = NOW()
      `;

      await tokenDB.exec`COMMIT`;

      const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);

      return {
        success: true,
        transactionHash: mockTxHash,
        message: `Successfully transferred ${req.amount} tokens from ${req.fromAddress} to ${req.toAddress}`
      };
    } catch (error) {
      await tokenDB.exec`ROLLBACK`;
      throw error;
    }
  }
);
