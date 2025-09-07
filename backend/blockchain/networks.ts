import { api } from "encore.dev/api";
import { blockchainDB } from "./db";

export interface Network {
  id: number;
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
  nativeCurrency: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNetworkRequest {
  name: string;
  chainId: number;
  rpcUrl: string;
  explorerUrl?: string;
  nativeCurrency: string;
}

export interface ListNetworksResponse {
  networks: Network[];
}

// List all blockchain networks
export const listNetworks = api<void, ListNetworksResponse>(
  { expose: true, method: "GET", path: "/blockchain/networks" },
  async () => {
    const networks = await blockchainDB.queryAll<Network>`
      SELECT 
        id,
        name,
        chain_id as "chainId",
        rpc_url as "rpcUrl",
        explorer_url as "explorerUrl",
        native_currency as "nativeCurrency",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM networks 
      ORDER BY created_at DESC
    `;
    
    return { networks };
  }
);

// Get a specific network by ID
export const getNetwork = api<{ id: number }, Network>(
  { expose: true, method: "GET", path: "/blockchain/networks/:id" },
  async ({ id }) => {
    const network = await blockchainDB.queryRow<Network>`
      SELECT 
        id,
        name,
        chain_id as "chainId",
        rpc_url as "rpcUrl",
        explorer_url as "explorerUrl",
        native_currency as "nativeCurrency",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM networks 
      WHERE id = ${id}
    `;
    
    if (!network) {
      throw new Error("Network not found");
    }
    
    return network;
  }
);

// Create a new blockchain network
export const createNetwork = api<CreateNetworkRequest, Network>(
  { expose: true, method: "POST", path: "/blockchain/networks" },
  async (req) => {
    const network = await blockchainDB.queryRow<Network>`
      INSERT INTO networks (name, chain_id, rpc_url, explorer_url, native_currency)
      VALUES (${req.name}, ${req.chainId}, ${req.rpcUrl}, ${req.explorerUrl || null}, ${req.nativeCurrency})
      RETURNING 
        id,
        name,
        chain_id as "chainId",
        rpc_url as "rpcUrl",
        explorer_url as "explorerUrl",
        native_currency as "nativeCurrency",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    
    return network!;
  }
);

// Toggle network active status
export const toggleNetworkStatus = api<{ id: number }, Network>(
  { expose: true, method: "PATCH", path: "/blockchain/networks/:id/toggle" },
  async ({ id }) => {
    const network = await blockchainDB.queryRow<Network>`
      UPDATE networks 
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = ${id}
      RETURNING 
        id,
        name,
        chain_id as "chainId",
        rpc_url as "rpcUrl",
        explorer_url as "explorerUrl",
        native_currency as "nativeCurrency",
        is_active as "isActive",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    
    if (!network) {
      throw new Error("Network not found");
    }
    
    return network;
  }
);
