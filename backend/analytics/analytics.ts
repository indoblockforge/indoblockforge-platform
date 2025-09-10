import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const analyticsDB = SQLDatabase.named("blockchain");

// Types
export interface BlockchainOverview {
  totalNetworks: number;
  totalContracts: number;
  totalWallets: number;
  totalTokens: number;
  totalNFTs: number;
  totalTransactions: number;
  pendingTransactions: number;
}

export interface NetworkActivity {
  networkId: number;
  networkName: string;
  transactionCount: number;
  contractCount: number;
  totalValue: string;
  lastActivity: Date;
}

export interface TokenAnalytics {
  tokenId: number;
  tokenSymbol: string;
  tokenName: string;
  holderCount: number;
  totalSupply: string;
  transactionCount: number;
}

export interface DailyStats {
  date: string;
  transactionCount: number;
  uniqueUsers: number;
  totalValue: string;
  newWallets: number;
}

export interface TopHolders {
  address: string;
  balance: string;
  percentage: number;
}

export interface NetworkActivityResponse {
  activities: NetworkActivity[];
}

export interface TokenAnalyticsResponse {
  analytics: TokenAnalytics[];
}

export interface DailyStatsResponse {
  stats: DailyStats[];
}

export interface TopHoldersResponse {
  holders: TopHolders[];
}

// Helper: percentage calculation for token holders
function calculateHolderPercentage(balance: string, totalSupply: bigint): number {
  if (totalSupply === BigInt(0)) return 0;
  // Use 4 decimals for percentage precision
  return Number((BigInt(balance) * BigInt(10000) / totalSupply)) / 100;
}

// API: Blockchain overview dashboard
export const getOverview = api<void, BlockchainOverview>(
  { expose: true, method: "GET", path: "/analytics/overview" },
  async () => {
    const overview = await analyticsDB.queryRow<BlockchainOverview>`
      SELECT 
        (SELECT COUNT(*) FROM networks WHERE is_active = true) AS "totalNetworks",
        (SELECT COUNT(*) FROM smart_contracts) AS "totalContracts",
        (SELECT COUNT(*) FROM wallets) AS "totalWallets",
        (SELECT COUNT(*) FROM tokens) AS "totalTokens",
        (SELECT COUNT(*) FROM nft_metadata) AS "totalNFTs",
        (SELECT COUNT(*) FROM transactions) AS "totalTransactions",
        (SELECT COUNT(*) FROM transactions WHERE status = 'pending') AS "pendingTransactions"
    `;
    return overview!;
  }
);

// API: Network activity statistics
export const getNetworkActivity = api<void, NetworkActivityResponse>(
  { expose: true, method: "GET", path: "/analytics/networks" },
  async () => {
    const activities = await analyticsDB.queryAll<NetworkActivity>`
      SELECT 
        n.id AS "networkId",
        n.name AS "networkName",
        COALESCE(tx_stats.transaction_count, 0) AS "transactionCount",
        COALESCE(contract_stats.contract_count, 0) AS "contractCount",
        COALESCE(tx_stats.total_value, '0') AS "totalValue",
        COALESCE(tx_stats.last_activity, n.created_at) AS "lastActivity"
      FROM networks n
      LEFT JOIN (
        SELECT 
          network_id,
          COUNT(*) AS transaction_count,
          SUM(value)::text AS total_value,
          MAX(created_at) AS last_activity
        FROM transactions
        GROUP BY network_id
      ) tx_stats ON n.id = tx_stats.network_id
      LEFT JOIN (
        SELECT 
          network_id,
          COUNT(*) AS contract_count
        FROM smart_contracts
        GROUP BY network_id
      ) contract_stats ON n.id = contract_stats.network_id
      WHERE n.is_active = true
      ORDER BY "transactionCount" DESC
    `;
    return { activities };
  }
);

// API: Token analytics (top 20 tokens by holder count)
export const getTokenAnalytics = api<void, TokenAnalyticsResponse>(
  { expose: true, method: "GET", path: "/analytics/tokens" },
  async () => {
    const analytics = await analyticsDB.queryAll<TokenAnalytics>`
      SELECT 
        t.id AS "tokenId",
        t.symbol AS "tokenSymbol",
        t.name AS "tokenName",
        COALESCE(holder_stats.holder_count, 0) AS "holderCount",
        COALESCE(t.total_supply, '0')::text AS "totalSupply",
        COALESCE(tx_stats.transaction_count, 0) AS "transactionCount"
      FROM tokens t
      LEFT JOIN (
        SELECT 
          token_id,
          COUNT(*) AS holder_count
        FROM token_balances
        WHERE balance > 0
        GROUP BY token_id
      ) holder_stats ON t.id = holder_stats.token_id
      LEFT JOIN (
        SELECT 
          sc.id AS contract_id,
          COUNT(tx.id) AS transaction_count
        FROM smart_contracts sc
        LEFT JOIN transactions tx ON sc.address = tx.contract_address
        GROUP BY sc.id
      ) tx_stats ON t.contract_id = tx_stats.contract_id
      ORDER BY "holderCount" DESC
      LIMIT 20
    `;
    return { analytics };
  }
);

// API: Daily statistics for last N days (default 30)
export const getDailyStats = api<{ days?: number }, DailyStatsResponse>(
  { expose: true, method: "GET", path: "/analytics/daily" },
  async (req) => {
    const days = req.days && req.days > 0 ? req.days : 30;
    const stats = await analyticsDB.queryAll<DailyStats>`
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days - 1} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date AS date
      ),
      daily_transactions AS (
        SELECT 
          DATE(created_at) AS date,
          COUNT(*) AS transaction_count,
          COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) AS unique_users,
          SUM(value)::text AS total_value
        FROM transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      ),
      daily_wallets AS (
        SELECT 
          DATE(created_at) AS date,
          COUNT(*) AS new_wallets
        FROM wallets
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      )
      SELECT 
        ds.date::text,
        COALESCE(dt.transaction_count, 0) AS "transactionCount",
        COALESCE(dt.unique_users, 0) AS "uniqueUsers",
        COALESCE(dt.total_value, '0') AS "totalValue",
        COALESCE(dw.new_wallets, 0) AS "newWallets"
      FROM date_series ds
      LEFT JOIN daily_transactions dt ON ds.date = dt.date
      LEFT JOIN daily_wallets dw ON ds.date = dw.date
      ORDER BY ds.date
    `;
    return { stats };
  }
);

// API: Top token holders for specific token
export const getTopHolders = api<{ tokenId: number; limit?: number }, TopHoldersResponse>(
  { expose: true, method: "GET", path: "/analytics/tokens/:tokenId/holders" },
  async (req) => {
    const limit = req.limit && req.limit > 0 ? req.limit : 10;

    // Get total supply for percentage calculation
    const token = await analyticsDB.queryRow<{ totalSupply: string }>`
      SELECT COALESCE(total_supply, '0')::text AS "totalSupply"
      FROM tokens
      WHERE id = ${req.tokenId}
    `;
    if (!token) throw new Error("Token not found");
    const totalSupply = BigInt(token.totalSupply);

    const holders = await analyticsDB.queryAll<{ address: string; balance: string }>`
      SELECT 
        w.address,
        tb.balance::text
      FROM token_balances tb
      JOIN wallets w ON tb.wallet_id = w.id
      WHERE tb.token_id = ${req.tokenId} AND tb.balance > 0
      ORDER BY tb.balance DESC
      LIMIT ${limit}
    `;

    const processedHolders: TopHolders[] = holders.map(({ address, balance }) => ({
      address,
      balance,
      percentage: calculateHolderPercentage(balance, totalSupply),
    }));

    return { holders: processedHolders };
  }
);

// API: Blockchain health metrics
export const getHealthMetrics = api<
  void,
  {
    avgBlockTime: number;
    networkStatus: string;
    lastBlockHeight: number;
    totalGasUsed: string;
    avgGasPrice: string;
  }
>(
  { expose: true, method: "GET", path: "/analytics/health" },
  async () => {
    const metrics = await analyticsDB.queryRow<{
      avgBlockTime: number;
      networkStatus: string;
      lastBlockHeight: number;
      totalGasUsed: string;
      avgGasPrice: string;
    }>`
      SELECT 
        COALESCE(AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))), 0) AS "avgBlockTime",
        CASE 
          WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) > COUNT(*) * 0.1 
          THEN 'degraded'
          WHEN COUNT(CASE WHEN status = 'pending' THEN 1 END) > 100
          THEN 'congested'
          ELSE 'healthy'
        END AS "networkStatus",
        COALESCE(MAX(block_number), 0) AS "lastBlockHeight",
        COALESCE(SUM(gas_used), 0)::text AS "totalGasUsed",
        COALESCE(AVG(gas_price), 0)::text AS "avgGasPrice"
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `;
    return metrics!;
  }
);
