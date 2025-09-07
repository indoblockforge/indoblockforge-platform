import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const transactionDB = SQLDatabase.named("blockchain");

export interface Transaction {
  id: number;
  hash: string;
  networkId: number;
  fromAddress: string;
  toAddress?: string;
  value: string;
  gasPrice?: string;
  gasLimit?: number;
  gasUsed?: number;
  nonce?: number;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  status: string;
  transactionType: string;
  contractAddress?: string;
  logs?: any[];
  errorMessage?: string;
  createdAt: Date;
  confirmedAt?: Date;
}

export interface CreateTransactionRequest {
  hash: string;
  networkId: number;
  fromAddress: string;
  toAddress?: string;
  value: string;
  gasPrice?: string;
  gasLimit?: number;
  nonce?: number;
  transactionType: string;
  contractAddress?: string;
}

export interface UpdateTransactionRequest {
  hash: string;
  status: string;
  blockNumber?: number;
  blockHash?: string;
  transactionIndex?: number;
  gasUsed?: number;
  logs?: any[];
  errorMessage?: string;
}

export interface ListTransactionsResponse {
  transactions: Transaction[];
  total: number;
}

export interface TransactionStats {
  totalTransactions: number;
  pendingTransactions: number;
  confirmedTransactions: number;
  failedTransactions: number;
  totalValue: string;
}

// List transactions with pagination and filters
export const listTransactions = api<{
  page?: number;
  limit?: number;
  address?: string;
  networkId?: number;
  status?: string;
}, ListTransactionsResponse>(
  { expose: true, method: "GET", path: "/transaction/transactions" },
  async (req) => {
    const page = req.page || 1;
    const limit = req.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (req.address) {
      whereClause += ` AND (from_address = $${paramIndex} OR to_address = $${paramIndex})`;
      params.push(req.address);
      paramIndex++;
    }
    
    if (req.networkId) {
      whereClause += ` AND network_id = $${paramIndex}`;
      params.push(req.networkId);
      paramIndex++;
    }
    
    if (req.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(req.status);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        hash,
        network_id as "networkId",
        from_address as "fromAddress",
        to_address as "toAddress",
        value::text,
        gas_price::text as "gasPrice",
        gas_limit as "gasLimit",
        gas_used as "gasUsed",
        nonce,
        block_number as "blockNumber",
        block_hash as "blockHash",
        transaction_index as "transactionIndex",
        status,
        transaction_type as "transactionType",
        contract_address as "contractAddress",
        logs::text,
        error_message as "errorMessage",
        created_at as "createdAt",
        confirmed_at as "confirmedAt"
      FROM transactions 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const transactions = await transactionDB.rawQueryAll<Transaction>(query, ...params);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
    const countParams = params.slice(0, -2); // Remove limit and offset
    const countResult = await transactionDB.rawQueryRow<{ count: number }>(countQuery, ...countParams);
    
    // Parse logs JSON
    const processedTransactions = transactions.map(tx => ({
      ...tx,
      logs: tx.logs ? JSON.parse(tx.logs as string) : []
    }));
    
    return {
      transactions: processedTransactions,
      total: countResult?.count || 0
    };
  }
);

// Get specific transaction by hash
export const getTransaction = api<{ hash: string }, Transaction>(
  { expose: true, method: "GET", path: "/transaction/:hash" },
  async ({ hash }) => {
    const transaction = await transactionDB.queryRow<Transaction>`
      SELECT 
        id,
        hash,
        network_id as "networkId",
        from_address as "fromAddress",
        to_address as "toAddress",
        value::text,
        gas_price::text as "gasPrice",
        gas_limit as "gasLimit",
        gas_used as "gasUsed",
        nonce,
        block_number as "blockNumber",
        block_hash as "blockHash",
        transaction_index as "transactionIndex",
        status,
        transaction_type as "transactionType",
        contract_address as "contractAddress",
        logs::text,
        error_message as "errorMessage",
        created_at as "createdAt",
        confirmed_at as "confirmedAt"
      FROM transactions 
      WHERE hash = ${hash}
    `;
    
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    
    return {
      ...transaction,
      logs: transaction.logs ? JSON.parse(transaction.logs as string) : []
    };
  }
);

// Create a new transaction record
export const createTransaction = api<CreateTransactionRequest, Transaction>(
  { expose: true, method: "POST", path: "/transaction/transactions" },
  async (req) => {
    const transaction = await transactionDB.queryRow<Transaction>`
      INSERT INTO transactions (
        hash,
        network_id,
        from_address,
        to_address,
        value,
        gas_price,
        gas_limit,
        nonce,
        transaction_type,
        contract_address
      )
      VALUES (
        ${req.hash},
        ${req.networkId},
        ${req.fromAddress},
        ${req.toAddress || null},
        ${req.value},
        ${req.gasPrice || null},
        ${req.gasLimit || null},
        ${req.nonce || null},
        ${req.transactionType},
        ${req.contractAddress || null}
      )
      RETURNING 
        id,
        hash,
        network_id as "networkId",
        from_address as "fromAddress",
        to_address as "toAddress",
        value::text,
        gas_price::text as "gasPrice",
        gas_limit as "gasLimit",
        gas_used as "gasUsed",
        nonce,
        block_number as "blockNumber",
        block_hash as "blockHash",
        transaction_index as "transactionIndex",
        status,
        transaction_type as "transactionType",
        contract_address as "contractAddress",
        logs::text,
        error_message as "errorMessage",
        created_at as "createdAt",
        confirmed_at as "confirmedAt"
    `;
    
    return {
      ...transaction!,
      logs: []
    };
  }
);

// Update transaction status (when confirmed on blockchain)
export const updateTransaction = api<UpdateTransactionRequest, Transaction>(
  { expose: true, method: "PATCH", path: "/transaction/update" },
  async (req) => {
    const setParts: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    setParts.push(`status = $${paramIndex++}`);
    params.push(req.status);

    if (req.blockNumber !== undefined) {
      setParts.push(`block_number = $${paramIndex++}`);
      params.push(req.blockNumber);
    }
    
    if (req.blockHash !== undefined) {
      setParts.push(`block_hash = $${paramIndex++}`);
      params.push(req.blockHash);
    }
    
    if (req.transactionIndex !== undefined) {
      setParts.push(`transaction_index = $${paramIndex++}`);
      params.push(req.transactionIndex);
    }
    
    if (req.gasUsed !== undefined) {
      setParts.push(`gas_used = $${paramIndex++}`);
      params.push(req.gasUsed);
    }
    
    if (req.logs !== undefined) {
      setParts.push(`logs = $${paramIndex++}`);
      params.push(JSON.stringify(req.logs));
    }
    
    if (req.errorMessage !== undefined) {
      setParts.push(`error_message = $${paramIndex++}`);
      params.push(req.errorMessage);
    }

    if (req.status === 'confirmed') {
      setParts.push(`confirmed_at = NOW()`);
    }

    const query = `
      UPDATE transactions 
      SET ${setParts.join(', ')}
      WHERE hash = $${paramIndex}
      RETURNING 
        id,
        hash,
        network_id as "networkId",
        from_address as "fromAddress",
        to_address as "toAddress",
        value::text,
        gas_price::text as "gasPrice",
        gas_limit as "gasLimit",
        gas_used as "gasUsed",
        nonce,
        block_number as "blockNumber",
        block_hash as "blockHash",
        transaction_index as "transactionIndex",
        status,
        transaction_type as "transactionType",
        contract_address as "contractAddress",
        logs::text,
        error_message as "errorMessage",
        created_at as "createdAt",
        confirmed_at as "confirmedAt"
    `;
    
    params.push(req.hash);
    const transaction = await transactionDB.rawQueryRow<Transaction>(query, ...params);
    
    if (!transaction) {
      throw new Error("Transaction not found");
    }
    
    return {
      ...transaction,
      logs: transaction.logs ? JSON.parse(transaction.logs as string) : []
    };
  }
);

// Get transaction statistics
export const getTransactionStats = api<{ networkId?: number }, TransactionStats>(
  { expose: true, method: "GET", path: "/transaction/stats" },
  async (req) => {
    let whereClause = "";
    const params: any[] = [];
    
    if (req.networkId) {
      whereClause = "WHERE network_id = $1";
      params.push(req.networkId);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_transactions,
        COUNT(CASE WHEN status = 'confirmed' THEN 1 END) as confirmed_transactions,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_transactions,
        COALESCE(SUM(value), 0)::text as total_value
      FROM transactions
      ${whereClause}
    `;
    
    const stats = await transactionDB.rawQueryRow<{
      total_transactions: number;
      pending_transactions: number;
      confirmed_transactions: number;
      failed_transactions: number;
      total_value: string;
    }>(statsQuery, ...params);
    
    return {
      totalTransactions: stats?.total_transactions || 0,
      pendingTransactions: stats?.pending_transactions || 0,
      confirmedTransactions: stats?.confirmed_transactions || 0,
      failedTransactions: stats?.failed_transactions || 0,
      totalValue: stats?.total_value || "0"
    };
  }
);

// Get transactions by address (for wallet transaction history)
export const getTransactionsByAddress = api<{
  address: string;
  page?: number;
  limit?: number;
}, ListTransactionsResponse>(
  { expose: true, method: "GET", path: "/transaction/address/:address" },
  async (req) => {
    const page = req.page || 1;
    const limit = req.limit || 50;
    const offset = (page - 1) * limit;
    
    const transactions = await transactionDB.queryAll<Transaction>`
      SELECT 
        id,
        hash,
        network_id as "networkId",
        from_address as "fromAddress",
        to_address as "toAddress",
        value::text,
        gas_price::text as "gasPrice",
        gas_limit as "gasLimit",
        gas_used as "gasUsed",
        nonce,
        block_number as "blockNumber",
        block_hash as "blockHash",
        transaction_index as "transactionIndex",
        status,
        transaction_type as "transactionType",
        contract_address as "contractAddress",
        logs::text,
        error_message as "errorMessage",
        created_at as "createdAt",
        confirmed_at as "confirmedAt"
      FROM transactions 
      WHERE from_address = ${req.address} OR to_address = ${req.address}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    
    const countResult = await transactionDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE from_address = ${req.address} OR to_address = ${req.address}
    `;
    
    const processedTransactions = transactions.map(tx => ({
      ...tx,
      logs: tx.logs ? JSON.parse(tx.logs as string) : []
    }));
    
    return {
      transactions: processedTransactions,
      total: countResult?.count || 0
    };
  }
);
