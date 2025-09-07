import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { Wallet, Plus, Eye, Copy, ExternalLink } from 'lucide-react';

export default function Wallets() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>('');
  const [newWallet, setNewWallet] = useState({
    address: '',
    userId: 'demo-user',
    walletType: 'EOA',
    isCustodial: false,
    publicKey: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: wallets, isLoading } = useQuery({
    queryKey: ['wallets', 'demo-user'],
    queryFn: () => backend.wallet.listWallets({ userId: 'demo-user' }),
  });

  const { data: walletBalance } = useQuery({
    queryKey: ['wallet-balance', selectedWallet],
    queryFn: () => backend.wallet.getWalletBalance({ address: selectedWallet }),
    enabled: !!selectedWallet,
  });

  const createWalletMutation = useMutation({
    mutationFn: (data: typeof newWallet) => backend.wallet.createWallet(data),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Wallet created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['wallets'] });
      setIsCreateDialogOpen(false);
      setNewWallet({
        address: '',
        userId: 'demo-user',
        walletType: 'EOA',
        isCustodial: false,
        publicKey: '',
      });
    },
    onError: (error) => {
      console.error('Failed to create wallet:', error);
      toast({
        title: 'Error',
        description: 'Failed to create wallet',
        variant: 'destructive',
      });
    },
  });

  const handleCreateWallet = () => {
    if (!newWallet.address) {
      toast({
        title: 'Error',
        description: 'Please provide a wallet address',
        variant: 'destructive',
      });
      return;
    }

    createWalletMutation.mutate(newWallet);
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast({
      title: 'Copied',
      description: 'Address copied to clipboard',
    });
  };

  const generateRandomAddress = () => {
    const address = '0x' + Array.from({ length: 40 }, () => 
      Math.floor(Math.random() * 16).toString(16)
    ).join('');
    setNewWallet(prev => ({ ...prev, address }));
  };

  if (isLoading) {
    return <div>Loading wallets...</div>;
  }

  const walletTypes = [
    { value: 'EOA', label: 'Externally Owned Account' },
    { value: 'MULTISIG', label: 'Multi-Signature Wallet' },
    { value: 'CONTRACT', label: 'Contract Wallet' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wallets</h1>
          <p className="text-muted-foreground">
            Manage your blockchain wallets and view balances.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Wallet
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Wallet</DialogTitle>
              <DialogDescription>
                Connect an existing wallet or create a new one.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="address">Wallet Address</Label>
                <div className="flex space-x-2">
                  <Input
                    id="address"
                    placeholder="0x..."
                    value={newWallet.address}
                    onChange={(e) => setNewWallet(prev => ({ ...prev, address: e.target.value }))}
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={generateRandomAddress}
                  >
                    Generate
                  </Button>
                </div>
              </div>
              
              <div>
                <Label htmlFor="walletType">Wallet Type</Label>
                <Select 
                  value={newWallet.walletType} 
                  onValueChange={(value) => setNewWallet(prev => ({ ...prev, walletType: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet type" />
                  </SelectTrigger>
                  <SelectContent>
                    {walletTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="publicKey">Public Key (Optional)</Label>
                <Input
                  id="publicKey"
                  placeholder="0x..."
                  value={newWallet.publicKey}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, publicKey: e.target.value }))}
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isCustodial"
                  checked={newWallet.isCustodial}
                  onChange={(e) => setNewWallet(prev => ({ ...prev, isCustodial: e.target.checked }))}
                  className="rounded"
                />
                <Label htmlFor="isCustodial">Custodial Wallet</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateWallet}
                disabled={createWalletMutation.isPending}
              >
                {createWalletMutation.isPending ? 'Adding...' : 'Add Wallet'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Wallets List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Wallets</h2>
          <div className="space-y-3">
            {wallets?.wallets.map((wallet) => (
              <Card 
                key={wallet.id}
                className={`cursor-pointer transition-colors ${
                  selectedWallet === wallet.address ? 'ring-2 ring-primary' : 'hover:bg-accent'
                }`}
                onClick={() => setSelectedWallet(wallet.address)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Wallet className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <div className="font-medium">
                          {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {wallet.walletType}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={wallet.isCustodial ? 'secondary' : 'outline'}>
                        {wallet.isCustodial ? 'Custodial' : 'Non-Custodial'}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyAddress(wallet.address);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {wallets?.wallets.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No wallets found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Add your first wallet to start managing your blockchain assets.
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Wallet
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Wallet Details & Balances */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Wallet Details</h2>
          
          {selectedWallet ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Selected Wallet</span>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleCopyAddress(selectedWallet)}
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-sm break-all">
                    {selectedWallet}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Token Balances</CardTitle>
                  <CardDescription>
                    Current token holdings in this wallet
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {walletBalance?.balances.length ? (
                    <div className="space-y-3">
                      {walletBalance.balances.map((balance, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-primary">
                                {balance.tokenSymbol.slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{balance.tokenName}</div>
                              <div className="text-sm text-muted-foreground">
                                {balance.tokenSymbol}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">
                              {(parseInt(balance.balance) / Math.pow(10, balance.decimals)).toFixed(4)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {balance.tokenSymbol}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      No token balances found
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button variant="outline" size="sm">
                      <Eye className="h-4 w-4 mr-2" />
                      View Transactions
                    </Button>
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Explorer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Wallet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Select a wallet</h3>
                <p className="text-muted-foreground text-center">
                  Choose a wallet from the list to view its details and balances.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
