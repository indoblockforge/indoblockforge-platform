import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Network, Plus, ExternalLink, Power } from 'lucide-react';

export default function Networks() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newNetwork, setNewNetwork] = useState({
    name: '',
    chainId: '',
    rpcUrl: '',
    explorerUrl: '',
    nativeCurrency: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: networks, isLoading } = useQuery({
    queryKey: ['networks'],
    queryFn: () => backend.blockchain.listNetworks(),
  });

  const createNetworkMutation = useMutation({
    mutationFn: (data: typeof newNetwork) => backend.blockchain.createNetwork({
      name: data.name,
      chainId: parseInt(data.chainId),
      rpcUrl: data.rpcUrl,
      explorerUrl: data.explorerUrl || undefined,
      nativeCurrency: data.nativeCurrency,
    }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Network created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
      setIsCreateDialogOpen(false);
      setNewNetwork({
        name: '',
        chainId: '',
        rpcUrl: '',
        explorerUrl: '',
        nativeCurrency: '',
      });
    },
    onError: (error) => {
      console.error('Failed to create network:', error);
      toast({
        title: 'Error',
        description: 'Failed to create network',
        variant: 'destructive',
      });
    },
  });

  const toggleNetworkMutation = useMutation({
    mutationFn: (id: number) => backend.blockchain.toggleNetworkStatus({ id }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Network status updated',
      });
      queryClient.invalidateQueries({ queryKey: ['networks'] });
    },
    onError: (error) => {
      console.error('Failed to toggle network status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update network status',
        variant: 'destructive',
      });
    },
  });

  const handleCreateNetwork = () => {
    if (!newNetwork.name || !newNetwork.chainId || !newNetwork.rpcUrl || !newNetwork.nativeCurrency) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    createNetworkMutation.mutate(newNetwork);
  };

  const handleToggleNetwork = (id: number) => {
    toggleNetworkMutation.mutate(id);
  };

  if (isLoading) {
    return <div>Loading networks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Blockchain Networks</h1>
          <p className="text-muted-foreground">
            Manage and monitor your blockchain network connections.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Network
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Network</DialogTitle>
              <DialogDescription>
                Configure a new blockchain network connection.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Network Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Ethereum Mainnet"
                  value={newNetwork.name}
                  onChange={(e) => setNewNetwork(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="chainId">Chain ID</Label>
                <Input
                  id="chainId"
                  type="number"
                  placeholder="e.g., 1"
                  value={newNetwork.chainId}
                  onChange={(e) => setNewNetwork(prev => ({ ...prev, chainId: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="rpcUrl">RPC URL</Label>
                <Input
                  id="rpcUrl"
                  placeholder="https://..."
                  value={newNetwork.rpcUrl}
                  onChange={(e) => setNewNetwork(prev => ({ ...prev, rpcUrl: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="explorerUrl">Block Explorer URL (Optional)</Label>
                <Input
                  id="explorerUrl"
                  placeholder="https://..."
                  value={newNetwork.explorerUrl}
                  onChange={(e) => setNewNetwork(prev => ({ ...prev, explorerUrl: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="nativeCurrency">Native Currency</Label>
                <Input
                  id="nativeCurrency"
                  placeholder="e.g., ETH"
                  value={newNetwork.nativeCurrency}
                  onChange={(e) => setNewNetwork(prev => ({ ...prev, nativeCurrency: e.target.value }))}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateNetwork}
                disabled={createNetworkMutation.isPending}
              >
                {createNetworkMutation.isPending ? 'Creating...' : 'Create Network'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {networks?.networks.map((network) => (
          <Card key={network.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <Network className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{network.name}</CardTitle>
              </div>
              <Badge variant={network.isActive ? 'default' : 'secondary'}>
                {network.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Chain ID:</span>
                  <span className="font-mono">{network.chainId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Currency:</span>
                  <span className="font-mono">{network.nativeCurrency}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">RPC:</span>
                  <span className="font-mono text-xs truncate max-w-32">
                    {network.rpcUrl}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant={network.isActive ? 'destructive' : 'default'}
                  onClick={() => handleToggleNetwork(network.id)}
                  disabled={toggleNetworkMutation.isPending}
                >
                  <Power className="h-4 w-4 mr-1" />
                  {network.isActive ? 'Disable' : 'Enable'}
                </Button>
                
                {network.explorerUrl && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(network.explorerUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Explorer
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {networks?.networks.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No networks configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first blockchain network to get started with IndoBlockForge.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Network
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
