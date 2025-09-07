import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import backend from '~backend/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { ShoppingBag, Plus, Image, ShoppingCart, Tag, X } from 'lucide-react';

export default function NFTMarketplace() {
  const [isCreateNFTOpen, setIsCreateNFTOpen] = useState(false);
  const [isListNFTOpen, setIsListNFTOpen] = useState(false);
  const [selectedNFT, setSelectedNFT] = useState<any>(null);
  
  const [newNFT, setNewNFT] = useState({
    tokenId: '',
    tokenNumber: '',
    name: '',
    description: '',
    imageUrl: '',
    attributes: '',
    ownerAddress: '',
  });

  const [listing, setListing] = useState({
    price: '',
    sellerAddress: '',
    expiresAt: '',
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: nfts, isLoading: nftsLoading } = useQuery({
    queryKey: ['nfts'],
    queryFn: () => backend.nft.listNFTs(),
  });

  const { data: marketplace, isLoading: marketplaceLoading } = useQuery({
    queryKey: ['marketplace'],
    queryFn: () => backend.nft.listMarketplace(),
  });

  const { data: tokens } = useQuery({
    queryKey: ['tokens'],
    queryFn: () => backend.token.listTokens(),
  });

  const createNFTMutation = useMutation({
    mutationFn: (data: typeof newNFT) => backend.nft.createNFT({
      tokenId: parseInt(data.tokenId),
      tokenNumber: data.tokenNumber,
      name: data.name,
      description: data.description,
      imageUrl: data.imageUrl,
      attributes: data.attributes ? JSON.parse(data.attributes) : undefined,
      ownerAddress: data.ownerAddress,
    }),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'NFT created successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['nfts'] });
      setIsCreateNFTOpen(false);
      resetNewNFT();
    },
    onError: (error) => {
      console.error('Failed to create NFT:', error);
      toast({
        title: 'Error',
        description: 'Failed to create NFT',
        variant: 'destructive',
      });
    },
  });

  const createListingMutation = useMutation({
    mutationFn: (data: { 
      tokenId: number; 
      tokenNumber: string; 
      sellerAddress: string; 
      price: string; 
      expiresAt?: string 
    }) => backend.nft.createListing(data),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'NFT listed for sale successfully',
      });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      setIsListNFTOpen(false);
      setSelectedNFT(null);
      resetListing();
    },
    onError: (error) => {
      console.error('Failed to list NFT:', error);
      toast({
        title: 'Error',
        description: 'Failed to list NFT for sale',
        variant: 'destructive',
      });
    },
  });

  const buyNFTMutation = useMutation({
    mutationFn: (data: { listingId: number; buyerAddress: string }) => 
      backend.nft.buyNFT(data),
    onSuccess: (result) => {
      toast({
        title: 'Success',
        description: result.message,
      });
      queryClient.invalidateQueries({ queryKey: ['marketplace'] });
      queryClient.invalidateQueries({ queryKey: ['nfts'] });
    },
    onError: (error) => {
      console.error('Failed to buy NFT:', error);
      toast({
        title: 'Error',
        description: 'Failed to purchase NFT',
        variant: 'destructive',
      });
    },
  });

  const resetNewNFT = () => {
    setNewNFT({
      tokenId: '',
      tokenNumber: '',
      name: '',
      description: '',
      imageUrl: '',
      attributes: '',
      ownerAddress: '',
    });
  };

  const resetListing = () => {
    setListing({
      price: '',
      sellerAddress: '',
      expiresAt: '',
    });
  };

  const handleCreateNFT = () => {
    if (!newNFT.tokenId || !newNFT.tokenNumber || !newNFT.name) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }
    createNFTMutation.mutate(newNFT);
  };

  const handleListNFT = () => {
    if (!selectedNFT || !listing.price || !listing.sellerAddress) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    createListingMutation.mutate({
      tokenId: selectedNFT.tokenId,
      tokenNumber: selectedNFT.tokenNumber,
      sellerAddress: listing.sellerAddress,
      price: listing.price,
      expiresAt: listing.expiresAt || undefined,
    });
  };

  const handleBuyNFT = (listingId: number) => {
    const buyerAddress = prompt('Enter your wallet address:');
    if (!buyerAddress) return;

    buyNFTMutation.mutate({
      listingId,
      buyerAddress,
    });
  };

  const erc721Tokens = tokens?.tokens.filter(t => t.tokenType === 'ERC721') || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">NFT Marketplace</h1>
          <p className="text-muted-foreground">
            Create, buy, and sell NFTs on your blockchain platform.
          </p>
        </div>
        
        <div className="flex space-x-2">
          <Dialog open={isCreateNFTOpen} onOpenChange={setIsCreateNFTOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Create NFT
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Create New NFT</DialogTitle>
                <DialogDescription>
                  Mint a new NFT with custom metadata.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="tokenId">Token Contract</Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newNFT.tokenId}
                      onChange={(e) => setNewNFT(prev => ({ ...prev, tokenId: e.target.value }))}
                    >
                      <option value="">Select token</option>
                      {erc721Tokens.map((token) => (
                        <option key={token.id} value={token.id.toString()}>
                          {token.symbol} - {token.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="tokenNumber">Token ID</Label>
                    <Input
                      id="tokenNumber"
                      placeholder="1"
                      value={newNFT.tokenNumber}
                      onChange={(e) => setNewNFT(prev => ({ ...prev, tokenNumber: e.target.value }))}
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="name">NFT Name</Label>
                  <Input
                    id="name"
                    placeholder="My Awesome NFT"
                    value={newNFT.name}
                    onChange={(e) => setNewNFT(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    placeholder="Description of your NFT..."
                    value={newNFT.description}
                    onChange={(e) => setNewNFT(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://..."
                    value={newNFT.imageUrl}
                    onChange={(e) => setNewNFT(prev => ({ ...prev, imageUrl: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="ownerAddress">Owner Address</Label>
                  <Input
                    id="ownerAddress"
                    placeholder="0x..."
                    value={newNFT.ownerAddress}
                    onChange={(e) => setNewNFT(prev => ({ ...prev, ownerAddress: e.target.value }))}
                  />
                </div>
                
                <div>
                  <Label htmlFor="attributes">Attributes (JSON)</Label>
                  <Textarea
                    id="attributes"
                    placeholder='[{"trait_type": "Color", "value": "Blue"}]'
                    value={newNFT.attributes}
                    onChange={(e) => setNewNFT(prev => ({ ...prev, attributes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreateNFT}
                  disabled={createNFTMutation.isPending}
                >
                  {createNFTMutation.isPending ? 'Creating...' : 'Create NFT'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="marketplace" className="space-y-4">
        <TabsList>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="my-nfts">My NFTs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="marketplace" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {marketplace?.listings.map((listing) => (
              <Card key={listing.id} className="overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {listing.nftImage ? (
                    <img 
                      src={listing.nftImage} 
                      alt={listing.nftName || 'NFT'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold truncate">
                      {listing.nftName || `Token #${listing.tokenNumber}`}
                    </h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Price</span>
                      <span className="font-bold">{listing.price} ETH</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Seller</span>
                      <span className="font-mono text-xs">
                        {listing.sellerAddress.slice(0, 6)}...{listing.sellerAddress.slice(-4)}
                      </span>
                    </div>
                    <Button 
                      className="w-full" 
                      size="sm"
                      onClick={() => handleBuyNFT(listing.id)}
                      disabled={buyNFTMutation.isPending}
                    >
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      Buy Now
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {marketplace?.listings.length === 0 && !marketplaceLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ShoppingBag className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No NFTs for sale</h3>
                <p className="text-muted-foreground text-center">
                  Check back later or create and list your own NFTs.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="my-nfts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nfts?.nfts.map((nft) => (
              <Card key={nft.id} className="overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {nft.imageUrl ? (
                    <img 
                      src={nft.imageUrl} 
                      alt={nft.name || 'NFT'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Image className="h-12 w-12 text-muted-foreground" />
                  )}
                </div>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <h3 className="font-semibold truncate">
                      {nft.name || `Token #${nft.tokenNumber}`}
                    </h3>
                    {nft.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {nft.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Owner</span>
                      <span className="font-mono text-xs">
                        {nft.ownerAddress ? (
                          `${nft.ownerAddress.slice(0, 6)}...${nft.ownerAddress.slice(-4)}`
                        ) : (
                          'Unowned'
                        )}
                      </span>
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full" 
                      size="sm"
                      onClick={() => {
                        setSelectedNFT(nft);
                        setIsListNFTOpen(true);
                      }}
                    >
                      <Tag className="h-4 w-4 mr-2" />
                      List for Sale
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {nfts?.nfts.length === 0 && !nftsLoading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Image className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No NFTs found</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Create your first NFT to get started.
                </p>
                <Button onClick={() => setIsCreateNFTOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Create NFT
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* List NFT Dialog */}
      <Dialog open={isListNFTOpen} onOpenChange={setIsListNFTOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>List NFT for Sale</DialogTitle>
            <DialogDescription>
              Set a price and list your NFT on the marketplace.
            </DialogDescription>
          </DialogHeader>
          
          {selectedNFT && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 p-4 border rounded-lg">
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  {selectedNFT.imageUrl ? (
                    <img 
                      src={selectedNFT.imageUrl} 
                      alt={selectedNFT.name}
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Image className="h-8 w-8 text-muted-foreground" />
                  )}
                </div>
                <div>
                  <h4 className="font-semibold">{selectedNFT.name}</h4>
                  <p className="text-sm text-muted-foreground">
                    Token #{selectedNFT.tokenNumber}
                  </p>
                </div>
              </div>
              
              <div>
                <Label htmlFor="price">Price (ETH)</Label>
                <Input
                  id="price"
                  placeholder="1.0"
                  value={listing.price}
                  onChange={(e) => setListing(prev => ({ ...prev, price: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="sellerAddress">Your Address</Label>
                <Input
                  id="sellerAddress"
                  placeholder="0x..."
                  value={listing.sellerAddress}
                  onChange={(e) => setListing(prev => ({ ...prev, sellerAddress: e.target.value }))}
                />
              </div>
              
              <div>
                <Label htmlFor="expiresAt">Expiration Date (Optional)</Label>
                <Input
                  id="expiresAt"
                  type="datetime-local"
                  value={listing.expiresAt}
                  onChange={(e) => setListing(prev => ({ ...prev, expiresAt: e.target.value }))}
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button
              type="submit"
              onClick={handleListNFT}
              disabled={createListingMutation.isPending}
            >
              {createListingMutation.isPending ? 'Listing...' : 'List for Sale'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
