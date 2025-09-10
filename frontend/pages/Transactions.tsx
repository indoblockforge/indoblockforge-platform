import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Activity, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle, Search } from 'lucide-react';

export default function Transactions() {
  const [filters, setFilters] = useState({
    page: 1,
    limit: 20,
    address: '',
    networkId: '',
    status: '',
  });

  // Error Handling Added
  const { data: transactions, isLoading, isError: isTxError, error: txError } = useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => backend.transaction.listTransactions({
      page: filters.page,
      limit: filters.limit,
      address: filters.address || undefined,
      networkId: filters.networkId ? parseInt(filters.networkId) : undefined,
      status: filters.status || undefined,
    }),
  });

  const { data: networks, isLoading: isNetworksLoading, isError: isNetworksError, error: networksError } = useQuery({
    queryKey: ['networks'],
    queryFn: () => backend.blockchain.listNetworks(),
  });

  const { data: stats, isLoading: isStatsLoading, isError: isStatsError, error: statsError } = useQuery({
    queryKey: ['transaction-stats'],
    queryFn: () => backend.transaction.getTransactionStats({}),
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Confirmed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Icon optimization: can be improved further if user address available
  const getTransactionIcon = (type: string, fromAddress: string, toAddress?: string) => {
    if (type === 'contract_deploy') return <Activity className="h-4 w-4 text-blue-500" />;
    return <ArrowUpRight className="h-4 w-4 text-gray-500" />;
  };

  const formatValue = (value: string) => {
    const ethValue = parseFloat(value || "0") / Math.pow(10, 18);
    return ethValue.toFixed(6);
  };

  const handleSearch = () => {
    setFilters(prev => ({ ...prev, page: 1 }));
  };

  // Error UI
  if (isTxError) {
    return <div className="text-red-500">Error loading transactions: {txError?.message || 'Unknown error.'}</div>;
  }
  if (isNetworksError) {
    return <div className="text-red-500">Error loading networks: {networksError?.message || 'Unknown error.'}</div>;
  }
  if (isStatsError) {
    return <div className="text-red-500">Error loading stats: {statsError?.message || 'Unknown error.'}</div>;
  }
  if (isLoading || isNetworksLoading || isStatsLoading) {
    return <div>Loading transactions...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
        <p className="text-muted-foreground">
          Monitor all blockchain transactions across your networks.
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{stats.pendingTransactions}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Confirmed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.confirmedTransactions}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{stats.failedTransactions}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                placeholder="0x... or search address"
                value={filters.address}
                onChange={(e) => setFilters(prev => ({ ...prev, address: e.target.value }))}
              />
            </div>
            
            <div>
              <Label htmlFor="network">Network</Label>
              <Select 
                value={filters.networkId} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, networkId: value }))}
                disabled={isNetworksLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isNetworksLoading ? "Loading..." : "All networks"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Networks</SelectItem>
                  {networks?.networks?.map((network) => (
                    <SelectItem key={network.id} value={network.id.toString()}>
                      {network.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="status">Status</Label>
              <Select 
                value={filters.status} 
                onValueChange={(value) => setFilters(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-end">
              <Button onClick={handleSearch} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            {transactions?.total || 0} transactions found
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {transactions?.transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent transition-colors">
                <div className="flex items-center space-x-4">
                  <div className="p-2 bg-muted rounded-lg">
                    {getTransactionIcon(tx.transactionType, tx.fromAddress, tx.toAddress)}
                  </div>
                  
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm">
                        {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                      </span>
                      {getStatusBadge(tx.status)}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      <span>From: </span>
                      <span className="font-mono">
                        {tx.fromAddress.slice(0, 6)}...{tx.fromAddress.slice(-4)}
                      </span>
                      {tx.toAddress && (
                        <>
                          <span> → To: </span>
                          <span className="font-mono">
                            {tx.toAddress.slice(0, 6)}...{tx.toAddress.slice(-4)}
                          </span>
                        </>
                      )}
                    </div>
                    
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span>Type: {tx.transactionType.replace('_', ' ')}</span>
                      <span>Network: {tx.networkId}</span>
                      {tx.blockNumber && <span>Block: {tx.blockNumber}</span>}
                    </div>
                  </div>
                </div>
                
                <div className="text-right space-y-1">
                  <div className="font-semibold">
                    {formatValue(tx.value || "0")} ETH
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString()}
                  </div>
                  {tx.gasUsed && (
                    <div className="text-xs text-muted-foreground">
                      Gas: {tx.gasUsed.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {transactions?.transactions.length === 0 && (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No transactions found</h3>
              <p className="text-muted-foreground">
                {filters.address || filters.status || filters.networkId 
                  ? "Try adjusting your filters to see more results."
                  : "Transactions will appear here once your blockchain network becomes active."
                }
              </p>
            </div>
          )}
          
          {/* Pagination */}
          {transactions && transactions.total > filters.limit && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {((filters.page - 1) * filters.limit) + 1} to {Math.min(filters.page * filters.limit, transactions.total)} of {transactions.total} results
              </div>
              
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={filters.page <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={filters.page * filters.limit >= transactions.total}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
