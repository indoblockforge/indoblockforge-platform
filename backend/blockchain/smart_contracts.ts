import { api } from "encore.dev/api";
import { blockchainDB } from "./db";

// Import a validation library (e.g., zod) for runtime validation
import { z } from "zod";

/** Smart contract DB model and API types **/
export interface SmartContract {
  id: number;
  name: string;
  address: string;
  networkId: number;
  abi: string;
  bytecode?: string;
  version: string;
  contractType: string;
  isVerified: boolean;
  deployedAt: Date;
  deployedBy?: string;
  createdAt: Date;
}

/** Request validation schemas **/
const CreateContractSchema = z.object({
  name: z.string().min(3).max(128),
  address: z.string().length(42).regex(/^0x[a-fA-F0-9]{40}$/, "Invalid address"), // Ethereum address
  networkId: z.number().int().positive(),
  abi: z.string().min(2), // Could extend to validate ABI format
  bytecode: z.string().optional(),
  version: z.string().optional().default("1.0.0"),
  contractType: z.string().min(1).max(64),
  deployedBy: z.string().optional(),
});

const UpdateContractSchema = z.object({
  name: z.string().min(3).max(128).optional(),
  abi: z.string().min(2).optional(),
  version: z.string().optional(),
  isVerified: z.boolean().optional(),
});

export type CreateContractRequest = z.infer<typeof CreateContractSchema>;
export type UpdateContractRequest = z.infer<typeof UpdateContractSchema>;

export interface ListContractsResponse {
  contracts: SmartContract[];
}

// Helper: Auth check (stub, replace with real logic)
async function requireAuth(ctx: any) {
  // Example: throw if not authenticated
  // throw new Error("Unauthorized"); // Uncomment and implement for real use
}

// Helper: Error response
function errorResponse(code: number, message: string) {
  const err = new Error(message);
  // @ts-ignore
  err.statusCode = code;
  return err;
}

// List all smart contracts (with pagination)
export const listContracts = api<{ page?: number; perPage?: number }, ListContractsResponse>(
  { expose: true, method: "GET", path: "/blockchain/contracts" },
  async ({ page = 1, perPage = 25 }, ctx) => {
    // await requireAuth(ctx); // Uncomment for auth
    const offset = (page - 1) * perPage;
    const contracts = await blockchainDB.queryAll<SmartContract>`
      SELECT 
        id,
        name,
        address,
        network_id as "networkId",
        abi,
        bytecode,
        version,
        contract_type as "contractType",
        is_verified as "isVerified",
        deployed_at as "deployedAt",
        deployed_by as "deployedBy",
        created_at as "createdAt"
      FROM smart_contracts 
      ORDER BY created_at DESC
      LIMIT ${perPage} OFFSET ${offset}
    `;
    return { contracts };
  }
);

// Get a specific smart contract by ID
export const getContract = api<{ id: number }, SmartContract>(
  { expose: true, method: "GET", path: "/blockchain/contracts/:id" },
  async ({ id }, ctx) => {
    // await requireAuth(ctx);
    const contract = await blockchainDB.queryRow<SmartContract>`
      SELECT 
        id,
        name,
        address,
        network_id as "networkId",
        abi,
        bytecode,
        version,
        contract_type as "contractType",
        is_verified as "isVerified",
        deployed_at as "deployedAt",
        deployed_by as "deployedBy",
        created_at as "createdAt"
      FROM smart_contracts 
      WHERE id = ${id}
    `;
    if (!contract) {
      throw errorResponse(404, "Smart contract not found");
    }
    return contract;
  }
);

// Create a new smart contract
export const createContract = api<CreateContractRequest, SmartContract>(
  { expose: true, method: "POST", path: "/blockchain/contracts" },
  async (req, ctx) => {
    // await requireAuth(ctx);

    // Validate request
    const parsed = CreateContractSchema.safeParse(req);
    if (!parsed.success) {
      throw errorResponse(400, `Invalid input: ${parsed.error.message}`);
    }
    const input = parsed.data;

    // Check for duplicate address
    const existing = await blockchainDB.queryRow<SmartContract>`
      SELECT id FROM smart_contracts WHERE address = ${input.address}
    `;
    if (existing) {
      throw errorResponse(409, "A contract with this address already exists");
    }

    const contract = await blockchainDB.queryRow<SmartContract>`
      INSERT INTO smart_contracts (
        name, address, network_id, abi, bytecode, version, contract_type, deployed_by
      )
      VALUES (
        ${input.name}, 
        ${input.address}, 
        ${input.networkId}, 
        ${input.abi}, 
        ${input.bytecode || null}, 
        ${input.version || '1.0.0'}, 
        ${input.contractType}, 
        ${input.deployedBy || null}
      )
      RETURNING 
        id,
        name,
        address,
        network_id as "networkId",
        abi,
        bytecode,
        version,
        contract_type as "contractType",
        is_verified as "isVerified",
        deployed_at as "deployedAt",
        deployed_by as "deployedBy",
        created_at as "createdAt"
    `;
    return contract!;
  }
);

// Update an existing smart contract
export const updateContract = api<{ id: number } & UpdateContractRequest, SmartContract>(
  { expose: true, method: "PATCH", path: "/blockchain/contracts/:id" },
  async ({ id, ...updates }, ctx) => {
    // await requireAuth(ctx);

    // Validate request
    const parsed = UpdateContractSchema.safeParse(updates);
    if (!parsed.success) {
      throw errorResponse(400, `Invalid update input: ${parsed.error.message}`);
    }
    const input = parsed.data;

    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (input.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      params.push(input.name);
    }
    if (input.abi !== undefined) {
      setParts.push(`abi = $${paramIndex++}`);
      params.push(input.abi);
    }
    if (input.version !== undefined) {
      setParts.push(`version = $${paramIndex++}`);
      params.push(input.version);
    }
    if (input.isVerified !== undefined) {
      setParts.push(`is_verified = $${paramIndex++}`);
      params.push(input.isVerified);
    }

    if (setParts.length === 0) {
      throw errorResponse(400, "No fields to update");
    }

    const query = `
      UPDATE smart_contracts 
      SET ${setParts.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING 
        id,
        name,
        address,
        network_id as "networkId",
        abi,
        bytecode,
        version,
        contract_type as "contractType",
        is_verified as "isVerified",
        deployed_at as "deployedAt",
        deployed_by as "deployedBy",
        created_at as "createdAt"
    `;
    params.push(id);

    const contract = await blockchainDB.rawQueryRow<SmartContract>(query, ...params);
    if (!contract) {
      throw errorResponse(404, "Smart contract not found");
    }
    return contract;
  }
);

// Delete a smart contract (with integrity check stub)
export const deleteContract = api<{ id: number }, void>(
  { expose: true, method: "DELETE", path: "/blockchain/contracts/:id" },
  async ({ id }, ctx) => {
    // await requireAuth(ctx);

    // Example: check for dependent records (stub, implement as needed)
    // const deps = await blockchainDB.queryAll<any>`SELECT id FROM contract_usages WHERE contract_id = ${id}`;
    // if (deps.length > 0) {
    //   throw errorResponse(409, "Cannot delete contract with dependent records");
    // }

    await blockchainDB.exec`
      DELETE FROM smart_contracts WHERE id = ${id}
    `;
  }
);
