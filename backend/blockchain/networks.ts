import { api } from "encore.dev/api";
import { blockchainDB } from "./db";
import { z } from "zod";

// --- Type Definitions ---

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

// --- Validation Schemas ---

const CreateNetworkSchema = z.object({
  name: z.string().min(3).max(64),
  chainId: z.number().int().positive(),
  rpcUrl: z.string().url(),
  explorerUrl: z.string().url().optional(),
  nativeCurrency: z.string().min(1).max(32),
});
export type CreateNetworkRequest = z.infer<typeof CreateNetworkSchema>;

export interface ListNetworksResponse {
  networks: Network[];
}

// --- Helper Functions ---

// Auth placeholder
async function requireAuth(ctx: any) {
  // throw new Error("Unauthorized"); // Uncomment and replace for real authentication
}

// Standardized error response
function errorResponse(code: number, message: string) {
  const err = new Error(message);
  // @ts-ignore
  err.statusCode = code;
  return err;
}

// --- API Endpoints ---

// List all blockchain networks (with pagination)
export const listNetworks = api<{ page?: number; perPage?: number }, ListNetworksResponse>(
  { expose: true, method: "GET", path: "/blockchain/networks" },
  async ({ page = 1, perPage = 25 }, ctx) => {
    // await requireAuth(ctx);
    const offset = (page - 1) * perPage;
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
      LIMIT ${perPage} OFFSET ${offset}
    `;
    return { networks };
  }
);

// Get a specific network by ID
export const getNetwork = api<{ id: number }, Network>(
  { expose: true, method: "GET", path: "/blockchain/networks/:id" },
  async ({ id }, ctx) => {
    // await requireAuth(ctx);
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
      throw errorResponse(404, "Network not found");
    }
    return network;
  }
);

// Create a new blockchain network
export const createNetwork = api<CreateNetworkRequest, Network>(
  { expose: true, method: "POST", path: "/blockchain/networks" },
  async (req, ctx) => {
    // await requireAuth(ctx);

    const parsed = CreateNetworkSchema.safeParse(req);
    if (!parsed.success) {
      throw errorResponse(400, `Invalid input: ${parsed.error.message}`);
    }
    const input = parsed.data;

    // Check for duplicate chainId
    const existing = await blockchainDB.queryRow<Network>`
      SELECT id FROM networks WHERE chain_id = ${input.chainId}
    `;
    if (existing) {
      throw errorResponse(409, "A network with this chainId already exists");
    }

    const network = await blockchainDB.queryRow<Network>`
      INSERT INTO networks (name, chain_id, rpc_url, explorer_url, native_currency)
      VALUES (${input.name}, ${input.chainId}, ${input.rpcUrl}, ${input.explorerUrl || null}, ${input.nativeCurrency})
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
  async ({ id }, ctx) => {
    // await requireAuth(ctx);

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
      throw errorResponse(404, "Network not found");
    }
    return network;
  }
);
