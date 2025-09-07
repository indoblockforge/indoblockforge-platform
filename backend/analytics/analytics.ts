import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const analyticsDB = SQLDatabase.named("blockchain");

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

// Get blockchain overview dashboard
export const getOverview = api<void, BlockchainOverview>(
  { expose: true, method: "GET", path: "/analytics/overview" },
  async () => {
    const overview = await analyticsDB.queryRow<BlockchainOverview>`
      SELECT 
        (SELECT COUNT(*) FROM networks WHERE is_active = true) as "totalNetworks",
        (SELECT COUNT(*) FROM smart_contracts) as "totalContracts",
        (SELECT COUNT(*) FROM wallets) as "totalWallets",
        (SELECT COUNT(*) FROM tokens) as "totalTokens",
        (SELECT COUNT(*) FROM nft_metadata) as "totalNFTs",
        (SELECT COUNT(*) FROM transactions) as "totalTransactions",
        (SELECT COUNT(*) FROM transactions WHERE status = 'pending') as "pendingTransactions"
    `;
    
    return overview!;
  }
);

// Get network activity statistics
export const getNetworkActivity = api<void, NetworkActivityResponse>(
  { expose: true, method: "GET", path: "/analytics/networks" },
  async () => {
    const activities = await analyticsDB.queryAll<NetworkActivity>`
      SELECT 
        n.id as "networkId",
        n.name as "networkName",
        COALESCE(tx_stats.transaction_count, 0) as "transactionCount",
        COALESCE(contract_stats.contract_count, 0) as "contractCount",
        COALESCE(tx_stats.total_value, '0') as "totalValue",
        COALESCE(tx_stats.last_activity, n.created_at) as "lastActivity"
      FROM networks n
      LEFT JOIN (
        SELECT 
          network_id,
          COUNT(*) as transaction_count,
          SUM(value)::text as total_value,
          MAX(created_at) as last_activity
        FROM transactions
        GROUP BY network_id
      ) tx_stats ON n.id = tx_stats.network_id
      LEFT JOIN (
        SELECT 
          network_id,
          COUNT(*) as contract_count
        FROM smart_contracts
        GROUP BY network_id
      ) contract_stats ON n.id = contract_stats.network_id
      WHERE n.is_active = true
      ORDER BY "transactionCount" DESC
    `;
    
    return { activities };
  }
);

// Get token analytics
export const getTokenAnalytics = api<void, TokenAnalyticsResponse>(
  { expose: true, method: "GET", path: "/analytics/tokens" },
  async () => {
    const analytics = await analyticsDB.queryAll<TokenAnalytics>`
      SELECT 
        t.id as "tokenId",
        t.symbol as "tokenSymbol",
        t.name as "tokenName",
        COALESCE(holder_stats.holder_count, 0) as "holderCount",
        COALESCE(t.total_supply, '0')::text as "totalSupply",
        COALESCE(tx_stats.transaction_count, 0) as "transactionCount"
      FROM tokens t
      LEFT JOIN (
        SELECT 
          token_id,
          COUNT(*) as holder_count
        FROM token_balances
        WHERE balance > 0
        GROUP BY token_id
      ) holder_stats ON t.id = holder_stats.token_id
      LEFT JOIN (
        SELECT 
          sc.id as contract_id,
          COUNT(tx.id) as transaction_count
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

// Get daily statistics for the last 30 days
export const getDailyStats = api<{ days?: number }, DailyStatsResponse>(
  { expose: true, method: "GET", path: "/analytics/daily" },
  async (req) => {
    const days = req.days || 30;
    
    const stats = await analyticsDB.queryAll<DailyStats>`
      WITH date_series AS (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '${days - 1} days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as date
      ),
      daily_transactions AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as transaction_count,
          COUNT(DISTINCT from_address) + COUNT(DISTINCT to_address) as unique_users,
          SUM(value)::text as total_value
        FROM transactions
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      ),
      daily_wallets AS (
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as new_wallets
        FROM wallets
        WHERE created_at >= CURRENT_DATE - INTERVAL '${days} days'
        GROUP BY DATE(created_at)
      )
      SELECT 
        ds.date::text,
        COALESCE(dt.transaction_count, 0) as "transactionCount",
        COALESCE(dt.unique_users, 0) as "uniqueUsers",
        COALESCE(dt.total_value, '0') as "totalValue",
        COALESCE(dw.new_wallets, 0) as "newWallets"
      FROM date_series ds
      LEFT JOIN daily_transactions dt ON ds.date = dt.date
      LEFT JOIN daily_wallets dw ON ds.date = dw.date
      ORDER BY ds.date
    `;
    
    return { stats };
  }
);

// Get top token holders for a specific token
export const getTopHolders = api<{ tokenId: number; limit?: number }, TopHoldersResponse>(
  { expose: true, method: "GET", path: "/analytics/tokens/:tokenId/holders" },
  async (req) => {
    const limit = req.limit || 10;
    
    // First get total supply for percentage calculation
    const token = await analyticsDB.queryRow<{ totalSupply: string }>`
      SELECT COALESCE(total_supply, '0')::text as "totalSupply"
      FROM tokens
      WHERE id = ${req.tokenId}
    `;
    
    if (!token) {
      throw new Error("Token not found");
    }
    
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
    
    const processedHolders: TopHolders[] = holders.map(holder => ({
      address: holder.address,
      balance: holder.balance,
      percentage: totalSupply > 0 ? Number((BigInt(holder.balance) * BigInt(10000) / totalSupply)) / 100 : 0
    }));
    
    return { holders: processedHolders };
  }
);

// Get blockchain health metrics
export const getHealthMetrics = api<void, {
  avgBlockTime: number;
  networkStatus: string;
  lastBlockHeight: number;
  totalGasUsed: string;
  avgGasPrice: string;
}>(
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
        COALESCE(AVG(EXTRACT(EPOCH FROM (confirmed_at - created_at))), 0) as "avgBlockTime",
        CASE 
          WHEN COUNT(CASE WHEN status = 'failed' THEN 1 END) > COUNT(*) * 0.1 
          THEN 'degraded'
          WHEN COUNT(CASE WHEN status = 'pending' THEN 1 END) > 100
          THEN 'congested'
          ELSE 'healthy'
        END as "networkStatus",
        COALESCE(MAX(block_number), 0) as "lastBlockHeight",
        COALESCE(SUM(gas_used), 0)::text as "totalGasUsed",
        COALESCE(AVG(gas_price), 0)::text as "avgGasPrice"
      FROM transactions
      WHERE created_at >= NOW() - INTERVAL '1 hour'
    `;
    
    return metrics!;
  }
);
