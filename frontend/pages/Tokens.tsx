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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Coins, Plus, ArrowUpCircle, ArrowDownCircle, ArrowRightLeft } from 'lucide-react';

export default function Tokens() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<{
    type: 'mint' | 'burn' | 'transfer' | null;
    tokenId?: number;
  }>({ type: null });
  
  const [newToken, setNewToken] = useState({
    contractId: '',
    symbol: '',
    name: '',
    decimals: '18',
    tokenType: 'ERC20',
    totalSupply: '',
    maxSupply: '',
    isMintable: true,
    isBurnable: true,
  });

  const [tokenAction, setTokenAction] = useState({
    toAddress: '',
    fromAddress: '',
    amount: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tokens, isLoading } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => backend.token.listTokens(),
  });

  const { data: contracts } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => backend.blockchain.listContracts(),
  });

  const createTokenMutation = useMutation({
    mutationFn: (data: typeof newToken) => backend.token.createToken({
      contractId: parseInt(data.contractId),
      symbol: data.symbol,
      name: data.name,
      decimals: parseInt(data.decimals),
      tokenType: data.tokenType,
      totalSupply: data.totalSupply || undefined,
      maxSupply: data.maxSupply || undefined,
      isMintable: data.isMintable,
      isBurnable: data.isBurnable,
    }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Token created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      setIsCreateDialogOpen(false);
      resetNewToken();
    },
    onError: (error) => {
      console.error('Failed to create token:', error);
      toast({
        title: 'Error',
        description: 'Failed to create token',
        variant: 'destructive',
      });
    },
  });

  const mintTokenMutation = useMutation({
    mutationFn: (data: { tokenId: number; toAddress: string; amount: string }) =>
      backend.token.mintToken(data),
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      setActionDialog({ type: null });
      resetTokenAction();
    },
    onError: (error) => {
      console.error('Failed to mint tokens:', error);
      toast({
        title: 'Error',
        description: 'Failed to mint tokens',
        variant: 'destructive',
      });
    },
  });

  const burnTokenMutation = useMutation({
    mutationFn: (data: { tokenId: number; fromAddress: string; amount: string }) =>
      backend.token.burnToken(data),
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      setActionDialog({ type: null });
      resetTokenAction();
    },
    onError: (error) => {
      console.error('Failed to burn tokens:', error);
      toast({
        title: 'Error',
        description: 'Failed to burn tokens',
        variant: 'destructive',
      });
    },
  });

  const transferTokenMutation = useMutation({
    mutationFn: (data: { tokenId: number; fromAddress: string; toAddress: string; amount: string }) =>
      backend.token.transferToken(data),
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['tokens'] });
      setActionDialog({ type: null });
      resetTokenAction();
    },
    onError: (error) => {
      console.error('Failed to transfer tokens:', error);
      toast({
        title: 'Error',
        description: 'Failed to transfer tokens',
        variant: 'destructive',
      });
    },
  });

  const resetNewToken = () => {
    setNewToken({
      contractId: '',
      symbol: '',
      name: '',
      decimals: '18',
      tokenType: 'ERC20',
      totalSupply: '',
      maxSupply: '',
      isMintable: true,
      isBurnable: true,
    });
  };

  const resetTokenAction = () => {
    setTokenAction({
      toAddress: '',
      fromAddress: '',
      amount: '',
    });
  };

  const handleCreateToken = () => {
    if (!newToken.contractId || !newToken.symbol || !newToken.name) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    createTokenMutation.mutate(newToken);
  };

  const handleTokenAction = () => {
    if (!actionDialog.tokenId) return;

    if (actionDialog.type === 'mint') {
      if (!tokenAction.toAddress || !tokenAction.amount) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
      mintTokenMutation.mutate({
        tokenId: actionDialog.tokenId,
        toAddress: tokenAction.toAddress,
        amount: tokenAction.amount,
      });
    } else if (actionDialog.type === 'burn') {
      if (!tokenAction.fromAddress || !tokenAction.amount) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
      burnTokenMutation.mutate({
        tokenId: actionDialog.tokenId,
        fromAddress: tokenAction.fromAddress,
        amount: tokenAction.amount,
      });
    } else if (actionDialog.type === 'transfer') {
      if (!tokenAction.fromAddress || !tokenAction.toAddress || !tokenAction.amount) {
        toast({
          title: 'Error',
          description: 'Please fill in all required fields',
          variant: 'destructive',
        });
        return;
      }
      transferTokenMutation.mutate({
        tokenId: actionDialog.tokenId,
        fromAddress: tokenAction.fromAddress,
        toAddress: tokenAction.toAddress,
        amount: tokenAction.amount,
      });
    }
  };

  if (isLoading) {
    return <div>Loading tokens...</div>;
  }

  const tokenTypes = [
    { value: 'ERC20', label: 'ERC-20 Fungible Token' },
    { value: 'ERC721', label: 'ERC-721 NFT' },
    { value: 'ERC1155', label: 'ERC-1155 Multi-Token' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tokens</h1>
          <p className="text-muted-foreground">
            Create and manage your blockchain tokens.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Token</DialogTitle>
              <DialogDescription>
                Define the properties of your new token.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="symbol">Token Symbol</Label>
                  <Input
                    id="symbol"
                    placeholder="e.g., MTK"
                    value={newToken.symbol}
                    onChange={(e) => setNewToken(prev => ({ ...prev, symbol: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="name">Token Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., My Token"
                    value={newToken.name}
                    onChange={(e) => setNewToken(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="contract">Smart Contract</Label>
                <Select 
                  value={newToken.contractId} 
                  onValueChange={(value) => setNewToken(prev => ({ ...prev, contractId: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract" />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts?.contracts.map((contract) => (
                      <SelectItem key={contract.id} value={contract.id.toString()}>
                        {contract.name} ({contract.contractType})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tokenType">Token Type</Label>
                  <Select 
                    value={newToken.tokenType} 
                    onValueChange={(value) => setNewToken(prev => ({ ...prev, tokenType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {tokenTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="decimals">Decimals</Label>
                  <Input
                    id="decimals"
                    type="number"
                    placeholder="18"
                    value={newToken.decimals}
                    onChange={(e) => setNewToken(prev => ({ ...prev, decimals: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="totalSupply">Total Supply (Optional)</Label>
                  <Input
                    id="totalSupply"
                    placeholder="1000000"
                    value={newToken.totalSupply}
                    onChange={(e) => setNewToken(prev => ({ ...prev, totalSupply: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="maxSupply">Max Supply (Optional)</Label>
                  <Input
                    id="maxSupply"
                    placeholder="10000000"
                    value={newToken.maxSupply}
                    onChange={(e) => setNewToken(prev => ({ ...prev, maxSupply: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="flex space-x-4">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isMintable"
                    checked={newToken.isMintable}
                    onChange={(e) => setNewToken(prev => ({ ...prev, isMintable: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="isMintable">Mintable</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isBurnable"
                    checked={newToken.isBurnable}
                    onChange={(e) => setNewToken(prev => ({ ...prev, isBurnable: e.target.checked }))}
                    className="rounded"
                  />
                  <Label htmlFor="isBurnable">Burnable</Label>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateToken}
                disabled={createTokenMutation.isPending}
              >
                {createTokenMutation.isPending ? 'Creating...' : 'Create Token'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tokens?.tokens.map((token) => (
          <Card key={token.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                  <Coins className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{token.symbol}</CardTitle>
                  <p className="text-sm text-muted-foreground">{token.name}</p>
                </div>
              </div>
              <Badge variant="outline">{token.tokenType}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Decimals:</span>
                  <span>{token.decimals}</span>
                </div>
                {token.totalSupply && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Supply:</span>
                    <span>{parseInt(token.totalSupply).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network:</span>
                  <span>{token.networkId}</span>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {token.isMintable && (
                  <Badge variant="secondary" className="text-xs">Mintable</Badge>
                )}
                {token.isBurnable && (
                  <Badge variant="secondary" className="text-xs">Burnable</Badge>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                {token.isMintable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionDialog({ type: 'mint', tokenId: token.id })}
                  >
                    <ArrowUpCircle className="h-3 w-3 mr-1" />
                    Mint
                  </Button>
                )}
                {token.isBurnable && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setActionDialog({ type: 'burn', tokenId: token.id })}
                  >
                    <ArrowDownCircle className="h-3 w-3 mr-1" />
                    Burn
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActionDialog({ type: 'transfer', tokenId: token.id })}
                >
                  <ArrowRightLeft className="h-3 w-3 mr-1" />
                  Transfer
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tokens?.tokens.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Coins className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tokens found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first token to start building your blockchain economy.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Token
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Token Action Dialog */}
      <Dialog 
        open={actionDialog.type !== null} 
        onOpenChange={() => setActionDialog({ type: null })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionDialog.type === 'mint' && 'Mint Tokens'}
              {actionDialog.type === 'burn' && 'Burn Tokens'}
              {actionDialog.type === 'transfer' && 'Transfer Tokens'}
            </DialogTitle>
            <DialogDescription>
              {actionDialog.type === 'mint' && 'Create new tokens and send them to an address.'}
              {actionDialog.type === 'burn' && 'Permanently remove tokens from circulation.'}
              {actionDialog.type === 'transfer' && 'Send tokens from one address to another.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {actionDialog.type === 'mint' && (
              <>
                <div>
                  <Label htmlFor="toAddress">To Address</Label>
                  <Input
                    id="toAddress"
                    placeholder="0x..."
                    value={tokenAction.toAddress}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, toAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    placeholder="1000"
                    value={tokenAction.amount}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </>
            )}
            
            {actionDialog.type === 'burn' && (
              <>
                <div>
                  <Label htmlFor="fromAddress">From Address</Label>
                  <Input
                    id="fromAddress"
                    placeholder="0x..."
                    value={tokenAction.fromAddress}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, fromAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    placeholder="1000"
                    value={tokenAction.amount}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </>
            )}
            
            {actionDialog.type === 'transfer' && (
              <>
                <div>
                  <Label htmlFor="fromAddress">From Address</Label>
                  <Input
                    id="fromAddress"
                    placeholder="0x..."
                    value={tokenAction.fromAddress}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, fromAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="toAddress">To Address</Label>
                  <Input
                    id="toAddress"
                    placeholder="0x..."
                    value={tokenAction.toAddress}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, toAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    placeholder="1000"
                    value={tokenAction.amount}
                    onChange={(e) => setTokenAction(prev => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleTokenAction}
              disabled={
                mintTokenMutation.isPending || 
                burnTokenMutation.isPending || 
                transferTokenMutation.isPending
              }
            >
              {(mintTokenMutation.isPending || burnTokenMutation.isPending || transferTokenMutation.isPending) 
                ? 'Processing...' 
                : actionDialog.type === 'mint' ? 'Mint Tokens'
                : actionDialog.type === 'burn' ? 'Burn Tokens'
                : 'Transfer Tokens'
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
