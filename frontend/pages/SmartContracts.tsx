import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { FileCode2, Plus, ExternalLink, CheckCircle, XCircle } from 'lucide-react';

export default function SmartContracts() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newContract, setNewContract] = useState({
    name: '',
    address: '',
    networkId: '',
    abi: '',
    bytecode: '',
    version: '1.0.0',
    contractType: 'CUSTOM',
    deployedBy: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ['contracts'],
    queryFn: () => backend.blockchain.listContracts(),
  });

  const { data: networks } = useQuery({
    queryKey: ['networks'],
    queryFn: () => backend.blockchain.listNetworks(),
  });

  const createContractMutation = useMutation({
    mutationFn: (data: typeof newContract) => backend.blockchain.createContract({
      name: data.name,
      address: data.address,
      networkId: parseInt(data.networkId),
      abi: data.abi,
      bytecode: data.bytecode || undefined,
      version: data.version,
      contractType: data.contractType,
      deployedBy: data.deployedBy || undefined,
    }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Smart contract added successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      setIsCreateDialogOpen(false);
      setNewContract({
        name: '',
        address: '',
        networkId: '',
        abi: '',
        bytecode: '',
        version: '1.0.0',
        contractType: 'CUSTOM',
        deployedBy: '',
      });
    },
    onError: (error) => {
      console.error('Failed to create contract:', error);
      toast({
        title: 'Error',
        description: 'Failed to add smart contract',
        variant: 'destructive',
      });
    },
  });

  const handleCreateContract = () => {
    if (!newContract.name || !newContract.address || !newContract.networkId || !newContract.abi) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    createContractMutation.mutate(newContract);
  };

  if (isLoading) {
    return <div>Loading smart contracts...</div>;
  }

  const contractTypes = [
    { value: 'ERC20', label: 'ERC-20 Token' },
    { value: 'ERC721', label: 'ERC-721 NFT' },
    { value: 'ERC1155', label: 'ERC-1155 Multi-Token' },
    { value: 'CUSTOM', label: 'Custom Contract' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Contracts</h1>
          <p className="text-muted-foreground">
            Manage and monitor your deployed smart contracts.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Contract
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Smart Contract</DialogTitle>
              <DialogDescription>
                Register an existing smart contract or deploy a new one.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Contract Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., My Token Contract"
                    value={newContract.name}
                    onChange={(e) => setNewContract(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="address">Contract Address</Label>
                  <Input
                    id="address"
                    placeholder="0x..."
                    value={newContract.address}
                    onChange={(e) => setNewContract(prev => ({ ...prev, address: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="network">Network</Label>
                  <Select 
                    value={newContract.networkId} 
                    onValueChange={(value) => setNewContract(prev => ({ ...prev, networkId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select network" />
                    </SelectTrigger>
                    <SelectContent>
                      {networks?.networks.filter(n => n.isActive).map((network) => (
                        <SelectItem key={network.id} value={network.id.toString()}>
                          {network.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="contractType">Contract Type</Label>
                  <Select 
                    value={newContract.contractType} 
                    onValueChange={(value) => setNewContract(prev => ({ ...prev, contractType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractTypes.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="version">Version</Label>
                  <Input
                    id="version"
                    placeholder="1.0.0"
                    value={newContract.version}
                    onChange={(e) => setNewContract(prev => ({ ...prev, version: e.target.value }))}
                  />
                </div>
                <div>
                  <Label htmlFor="deployedBy">Deployed By (Optional)</Label>
                  <Input
                    id="deployedBy"
                    placeholder="0x..."
                    value={newContract.deployedBy}
                    onChange={(e) => setNewContract(prev => ({ ...prev, deployedBy: e.target.value }))}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="abi">Contract ABI (JSON)</Label>
                <Textarea
                  id="abi"
                  placeholder='[{"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}]'
                  value={newContract.abi}
                  onChange={(e) => setNewContract(prev => ({ ...prev, abi: e.target.value }))}
                  className="min-h-24"
                />
              </div>
              
              <div>
                <Label htmlFor="bytecode">Bytecode (Optional)</Label>
                <Textarea
                  id="bytecode"
                  placeholder="0x608060405234801561001057600080fd5b50..."
                  value={newContract.bytecode}
                  onChange={(e) => setNewContract(prev => ({ ...prev, bytecode: e.target.value }))}
                  className="min-h-16"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                onClick={handleCreateContract}
                disabled={createContractMutation.isPending}
              >
                {createContractMutation.isPending ? 'Adding...' : 'Add Contract'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {contracts?.contracts.map((contract) => (
          <Card key={contract.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <FileCode2 className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg truncate">{contract.name}</CardTitle>
              </div>
              <div className="flex items-center space-x-2">
                <Badge variant={contract.isVerified ? 'default' : 'secondary'}>
                  {contract.contractType}
                </Badge>
                {contract.isVerified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Address:</span>
                  <span className="font-mono text-xs">
                    {contract.address.slice(0, 6)}...{contract.address.slice(-4)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Version:</span>
                  <span className="font-mono">{contract.version}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Network ID:</span>
                  <span className="font-mono">{contract.networkId}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Deployed:</span>
                  <span className="text-xs">
                    {new Date(contract.deployedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  View
                </Button>
                <Button size="sm" variant="outline">
                  Interact
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {contracts?.contracts.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileCode2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No smart contracts found</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first smart contract to start managing your blockchain applications.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Contract
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
