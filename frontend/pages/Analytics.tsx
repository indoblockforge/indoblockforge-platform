import React from 'react';
import { useQuery } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, TrendingUp, Users, Coins, Activity, Network } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';

export default function Analytics() {
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => backend.analytics.getOverview(),
  });

  const { data: dailyStats } = useQuery({
    queryKey: ['daily-stats-30'],
    queryFn: () => backend.analytics.getDailyStats({ days: 30 }),
  });

  const { data: networkActivity } = useQuery({
    queryKey: ['network-activity'],
    queryFn: () => backend.analytics.getNetworkActivity(),
  });

  const { data: tokenAnalytics } = useQuery({
    queryKey: ['token-analytics'],
    queryFn: () => backend.analytics.getTokenAnalytics(),
  });

  const { data: healthMetrics } = useQuery({
    queryKey: ['health-metrics'],
    queryFn: () => backend.analytics.getHealthMetrics(),
  });

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'congested': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive insights into your blockchain platform performance.
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value Locked</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$1,234,567</div>
            <p className="text-xs text-muted-foreground">+12.3% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalWallets || 0}</div>
            <p className="text-xs text-muted-foreground">Unique wallet addresses</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overview?.totalTransactions || 0}</div>
            <p className="text-xs text-muted-foreground">All-time transactions</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Health</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold capitalize ${getStatusColor(healthMetrics?.networkStatus || 'unknown')}`}>
              {healthMetrics?.networkStatus || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Avg block time: {healthMetrics?.avgBlockTime.toFixed(2)}s
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Daily Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Activity (30 Days)</CardTitle>
            <CardDescription>Transaction volume and user activity over time</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyStats && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyStats.stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="transactionCount" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Transactions"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="uniqueUsers" 
                    stroke="hsl(var(--destructive))" 
                    strokeWidth={2}
                    name="Unique Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Network Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Network Activity</CardTitle>
            <CardDescription>Transaction distribution across networks</CardDescription>
          </CardHeader>
          <CardContent>
            {networkActivity && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={networkActivity.activities.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="networkName" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="transactionCount" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Token Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Top Tokens by Holders</CardTitle>
            <CardDescription>Most popular tokens on your platform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {tokenAnalytics?.analytics.slice(0, 5).map((token, index) => (
                <div key={token.tokenId} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {token.tokenSymbol.slice(0, 2)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium">{token.tokenName}</div>
                      <div className="text-sm text-muted-foreground">{token.tokenSymbol}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{token.holderCount}</div>
                    <div className="text-xs text-muted-foreground">holders</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Platform Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Overview</CardTitle>
            <CardDescription>Key metrics and performance indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Smart Contracts</span>
                <span className="text-2xl font-bold">{overview?.totalContracts || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Tokens</span>
                <span className="text-2xl font-bold">{overview?.totalTokens || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">NFTs Minted</span>
                <span className="text-2xl font-bold">{overview?.totalNFTs || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active Networks</span>
                <span className="text-2xl font-bold">{overview?.totalNetworks || 0}</span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Pending Transactions</span>
                <Badge variant={overview && overview.pendingTransactions > 10 ? "destructive" : "secondary"}>
                  {overview?.pendingTransactions || 0}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Network Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Network Performance Details</CardTitle>
          <CardDescription>Comprehensive network statistics and health metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {networkActivity?.activities.map((network) => (
              <Card key={network.networkId}>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold">{network.networkName}</h4>
                      <Badge variant="outline">ID: {network.networkId}</Badge>
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transactions:</span>
                        <span className="font-medium">{network.transactionCount.toLocaleString()}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Contracts:</span>
                        <span className="font-medium">{network.contractCount}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Value:</span>
                        <span className="font-medium">{parseFloat(network.totalValue).toFixed(2)} ETH</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Activity:</span>
                        <span className="text-xs">{new Date(network.lastActivity).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
