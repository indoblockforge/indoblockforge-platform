import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const transactionDB = SQLDatabase.named("blockchain");

// Constants
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;

// Helper: Transaction Select Fields & Mapping
const TRANSACTION_SELECT_FIELDS = `
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

function parseTransactionRow(row: any): Transaction {
  return {
    ...row,
    logs: row.logs ? safeJsonParse(row.logs) : [],
  };
}

function safeJsonParse(str: string): any {
  try {
    return JSON.parse(str);
  } catch {
    return [];
  }
}

// Types
export interface Transaction { /* ...as before... */ }
export interface CreateTransactionRequest { /* ...as before... */ }
export interface UpdateTransactionRequest { /* ...as before... */ }
export interface ListTransactionsResponse { /* ...as before... */ }
export interface TransactionStats { /* ...as before... */ }

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
    const page = req.page ?? DEFAULT_PAGE;
    const limit = req.limit ?? DEFAULT_LIMIT;
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
      SELECT ${TRANSACTION_SELECT_FIELDS}
      FROM transactions 
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const transactions = await transactionDB.rawQueryAll<Transaction>(query, ...params);

    const countQuery = `SELECT COUNT(*) as count FROM transactions ${whereClause}`;
    const countParams = params.slice(0, -2);
    const countResult = await transactionDB.rawQueryRow<{ count: number }>(countQuery, ...countParams);

    return {
      transactions: transactions.map(parseTransactionRow),
      total: countResult?.count || 0
    };
  }
);

// Get specific transaction by hash
export const getTransaction = api<{ hash: string }, Transaction>(
  { expose: true, method: "GET", path: "/transaction/:hash" },
  async ({ hash }) => {
    const query = `
      SELECT ${TRANSACTION_SELECT_FIELDS}
      FROM transactions 
      WHERE hash = $1
    `;
    const transaction = await transactionDB.rawQueryRow<Transaction>(query, hash);

    if (!transaction) {
      throw new Error("Transaction not found");
    }

    return parseTransactionRow(transaction);
  }
);

// Create a new transaction record
export const createTransaction = api<CreateTransactionRequest, Transaction>(
  { expose: true, method: "POST", path: "/transaction/transactions" },
  async (req) => {
    const query = `
      INSERT INTO transactions (
        hash, network_id, from_address, to_address, value, gas_price, gas_limit, nonce, transaction_type, contract_address
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10
      )
      RETURNING ${TRANSACTION_SELECT_FIELDS}
    `;
    const params = [
      req.hash,
      req.networkId,
      req.fromAddress,
      req.toAddress || null,
      req.value,
      req.gasPrice || null,
      req.gasLimit || null,
      req.nonce || null,
      req.transactionType,
      req.contractAddress || null,
    ];
    const transaction = await transactionDB.rawQueryRow<Transaction>(query, ...params);

    return transaction ? parseTransactionRow(transaction) : null;
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
      RETURNING ${TRANSACTION_SELECT_FIELDS}
    `;
    params.push(req.hash);
    const transaction = await transactionDB.rawQueryRow<Transaction>(query, ...params);

    if (!transaction) {
      throw new Error("Transaction not found");
    }
    return parseTransactionRow(transaction);
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
    const page = req.page ?? DEFAULT_PAGE;
    const limit = req.limit ?? DEFAULT_LIMIT;
    const offset = (page - 1) * limit;

    const query = `
      SELECT ${TRANSACTION_SELECT_FIELDS}
      FROM transactions 
      WHERE from_address = $1 OR to_address = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const transactions = await transactionDB.rawQueryAll<Transaction>(query, req.address, limit, offset);

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM transactions 
      WHERE from_address = $1 OR to_address = $1
    `;
    const countResult = await transactionDB.rawQueryRow<{ count: number }>(countQuery, req.address);

    return {
      transactions: transactions.map(parseTransactionRow),
      total: countResult?.count || 0
    };
  }
);
