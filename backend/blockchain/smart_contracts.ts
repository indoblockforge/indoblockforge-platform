import { api } from "encore.dev/api";
import { blockchainDB } from "./db";

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

export interface CreateContractRequest {
  name: string;
  address: string;
  networkId: number;
  abi: string;
  bytecode?: string;
  version?: string;
  contractType: string;
  deployedBy?: string;
}

export interface UpdateContractRequest {
  name?: string;
  abi?: string;
  version?: string;
  isVerified?: boolean;
}

export interface ListContractsResponse {
  contracts: SmartContract[];
}

// List all smart contracts
export const listContracts = api<void, ListContractsResponse>(
  { expose: true, method: "GET", path: "/blockchain/contracts" },
  async () => {
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
    `;
    
    return { contracts };
  }
);

// Get a specific smart contract by ID
export const getContract = api<{ id: number }, SmartContract>(
  { expose: true, method: "GET", path: "/blockchain/contracts/:id" },
  async ({ id }) => {
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
      throw new Error("Smart contract not found");
    }
    
    return contract;
  }
);

// Create a new smart contract
export const createContract = api<CreateContractRequest, SmartContract>(
  { expose: true, method: "POST", path: "/blockchain/contracts" },
  async (req) => {
    const contract = await blockchainDB.queryRow<SmartContract>`
      INSERT INTO smart_contracts (
        name, address, network_id, abi, bytecode, version, contract_type, deployed_by
      )
      VALUES (
        ${req.name}, 
        ${req.address}, 
        ${req.networkId}, 
        ${req.abi}, 
        ${req.bytecode || null}, 
        ${req.version || '1.0.0'}, 
        ${req.contractType}, 
        ${req.deployedBy || null}
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
  async ({ id, ...updates }) => {
    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setParts.push(`name = $${paramIndex++}`);
      params.push(updates.name);
    }
    if (updates.abi !== undefined) {
      setParts.push(`abi = $${paramIndex++}`);
      params.push(updates.abi);
    }
    if (updates.version !== undefined) {
      setParts.push(`version = $${paramIndex++}`);
      params.push(updates.version);
    }
    if (updates.isVerified !== undefined) {
      setParts.push(`is_verified = $${paramIndex++}`);
      params.push(updates.isVerified);
    }

    if (setParts.length === 0) {
      throw new Error("No fields to update");
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
      throw new Error("Smart contract not found");
    }
    
    return contract;
  }
);

// Delete a smart contract
export const deleteContract = api<{ id: number }, void>(
  { expose: true, method: "DELETE", path: "/blockchain/contracts/:id" },
  async ({ id }) => {
    const result = await blockchainDB.exec`
      DELETE FROM smart_contracts WHERE id = ${id}
    `;
    
    // Note: In a real implementation, you might want to check if any dependent records exist
    // before allowing deletion
  }
);
