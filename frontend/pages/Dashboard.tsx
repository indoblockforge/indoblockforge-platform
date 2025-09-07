import React from 'react';
import { useQuery } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, Database, Wallet, Coins, Image, Activity, Clock, AlertTriangle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const { data: overview } = useQuery({
    queryKey: ['overview'],
    queryFn: () => backend.analytics.getOverview(),
  });

  const { data: dailyStats } = useQuery({
    queryKey: ['daily-stats'],
    queryFn: () => backend.analytics.getDailyStats({ days: 7 }),
  });

  const { data: networkActivity } = useQuery({
    queryKey: ['network-activity'],
    queryFn: () => backend.analytics.getNetworkActivity(),
  });

  const { data: healthMetrics } = useQuery({
    queryKey: ['health-metrics'],
    queryFn: () => backend.analytics.getHealthMetrics(),
  });

  const statsCards = [
    {
      title: 'Total Networks',
      value: overview?.totalNetworks || 0,
      icon: Network,
      description: 'Active blockchain networks',
    },
    {
      title: 'Smart Contracts',
      value: overview?.totalContracts || 0,
      icon: Database,
      description: 'Deployed contracts',
    },
    {
      title: 'Wallets',
      value: overview?.totalWallets || 0,
      icon: Wallet,
      description: 'Connected wallets',
    },
    {
      title: 'Tokens',
      value: overview?.totalTokens || 0,
      icon: Coins,
      description: 'Created tokens',
    },
    {
      title: 'NFTs',
      value: overview?.totalNFTs || 0,
      icon: Image,
      description: 'Minted NFTs',
    },
    {
      title: 'Transactions',
      value: overview?.totalTransactions || 0,
      icon: Activity,
      description: 'Total transactions',
    },
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'default';
      case 'degraded':
        return 'secondary';
      case 'congested':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your blockchain platform activity and metrics.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statsCards.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transaction Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Transactions</CardTitle>
            <CardDescription>Transaction volume over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            {dailyStats && (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dailyStats.stats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line 
                    type="monotone" 
                    dataKey="transactionCount" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
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
            <CardDescription>Transaction count by network</CardDescription>
          </CardHeader>
          <CardContent>
            {networkActivity && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={networkActivity.activities.slice(0, 5)}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="networkName" />
                  <YAxis />
                  <Tooltip />
                  <Bar 
                    dataKey="transactionCount" 
                    fill="hsl(var(--primary))"
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* System Health */}
        <Card>
          <CardHeader>
            <CardTitle>System Health</CardTitle>
            <CardDescription>Real-time blockchain network status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {healthMetrics && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Network Status</span>
                  <Badge variant={getStatusBadgeVariant(healthMetrics.networkStatus)}>
                    {healthMetrics.networkStatus}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avg Block Time</span>
                  <span className="text-sm text-muted-foreground">
                    {healthMetrics.avgBlockTime.toFixed(2)}s
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Last Block Height</span>
                  <span className="text-sm text-muted-foreground">
                    #{healthMetrics.lastBlockHeight.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Avg Gas Price</span>
                  <span className="text-sm text-muted-foreground">
                    {parseFloat(healthMetrics.avgGasPrice).toFixed(0)} gwei
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Pending Transactions Alert */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="h-5 w-5" />
              <span>Pending Transactions</span>
            </CardTitle>
            <CardDescription>Transactions waiting for confirmation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {overview?.pendingTransactions || 0}
            </div>
            {overview && overview.pendingTransactions > 10 && (
              <div className="flex items-center space-x-2 mt-2 text-sm text-orange-600">
                <AlertTriangle className="h-4 w-4" />
                <span>High pending transaction volume</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
              <div className="flex items-center space-x-3">
                <Database className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Deploy Contract</h3>
                  <p className="text-sm text-muted-foreground">Deploy a new smart contract</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
              <div className="flex items-center space-x-3">
                <Coins className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Create Token</h3>
                  <p className="text-sm text-muted-foreground">Issue a new token</p>
                </div>
              </div>
            </Card>
            
            <Card className="p-4 hover:bg-accent cursor-pointer transition-colors">
              <div className="flex items-center space-x-3">
                <Image className="h-8 w-8 text-primary" />
                <div>
                  <h3 className="font-semibold">Mint NFT</h3>
                  <p className="text-sm text-muted-foreground">Create a new NFT</p>
                </div>
              </div>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
