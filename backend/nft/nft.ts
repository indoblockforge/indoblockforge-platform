import { api } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const nftDB = SQLDatabase.named("blockchain");

export interface NFTMetadata {
  id: number;
  tokenId: number;
  tokenNumber: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  animationUrl?: string;
  externalUrl?: string;
  attributes?: any[];
  ownerAddress?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNFTRequest {
  tokenId: number;
  tokenNumber: string;
  name?: string;
  description?: string;
  imageUrl?: string;
  animationUrl?: string;
  externalUrl?: string;
  attributes?: any[];
  ownerAddress?: string;
}

export interface MarketplaceListing {
  id: number;
  tokenId: number;
  tokenNumber: string;
  sellerAddress: string;
  price: string;
  currencyTokenId?: number;
  status: string;
  expiresAt?: Date;
  createdAt: Date;
  soldAt?: Date;
  buyerAddress?: string;
  nftName?: string;
  nftImage?: string;
}

export interface CreateListingRequest {
  tokenId: number;
  tokenNumber: string;
  sellerAddress: string;
  price: string;
  currencyTokenId?: number;
  expiresAt?: Date;
}

export interface BuyNFTRequest {
  listingId: number;
  buyerAddress: string;
}

export interface ListNFTsResponse {
  nfts: NFTMetadata[];
}

export interface ListMarketplaceResponse {
  listings: MarketplaceListing[];
}

// Helper function: parse attributes JSON safely
function parseAttributes(attr: unknown): any[] {
  if (typeof attr === "string" && attr.trim()) {
    try {
      return JSON.parse(attr);
    } catch {
      return [];
    }
  }
  return Array.isArray(attr) ? attr : [];
}

// List all NFTs
export const listNFTs = api<void, ListNFTsResponse>(
  { expose: true, method: "GET", path: "/nft/nfts" },
  async () => {
    const nfts = await nftDB.queryAll<NFTMetadata>`
      SELECT 
        id,
        token_id as "tokenId",
        token_number::text as "tokenNumber",
        name,
        description,
        image_url as "imageUrl",
        animation_url as "animationUrl",
        external_url as "externalUrl",
        attributes::text as attributes,
        owner_address as "ownerAddress",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM nft_metadata
      ORDER BY created_at DESC
    `;
    return {
      nfts: nfts.map(nft => ({
        ...nft,
        attributes: parseAttributes(nft.attributes)
      }))
    };
  }
);

// Get NFTs by owner
export const getNFTsByOwner = api<{ ownerAddress: string }, ListNFTsResponse>(
  { expose: true, method: "GET", path: "/nft/owner/:ownerAddress" },
  async ({ ownerAddress }) => {
    const nfts = await nftDB.queryAll<NFTMetadata>`
      SELECT 
        id,
        token_id as "tokenId",
        token_number::text as "tokenNumber",
        name,
        description,
        image_url as "imageUrl",
        animation_url as "animationUrl",
        external_url as "externalUrl",
        attributes::text as attributes,
        owner_address as "ownerAddress",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM nft_metadata
      WHERE owner_address = ${ownerAddress}
      ORDER BY created_at DESC
    `;
    return {
      nfts: nfts.map(nft => ({
        ...nft,
        attributes: parseAttributes(nft.attributes)
      }))
    };
  }
);

// Get specific NFT
export const getNFT = api<{ id: number }, NFTMetadata>(
  { expose: true, method: "GET", path: "/nft/nfts/:id" },
  async ({ id }) => {
    const nft = await nftDB.queryRow<NFTMetadata>`
      SELECT 
        id,
        token_id as "tokenId",
        token_number::text as "tokenNumber",
        name,
        description,
        image_url as "imageUrl",
        animation_url as "animationUrl",
        external_url as "externalUrl",
        attributes::text as attributes,
        owner_address as "ownerAddress",
        created_at as "createdAt",
        updated_at as "updatedAt"
      FROM nft_metadata
      WHERE id = ${id}
    `;
    if (!nft) {
      throw new Error("NFT not found");
    }
    return {
      ...nft,
      attributes: parseAttributes(nft.attributes)
    };
  }
);

// Create/Mint NFT
export const createNFT = api<CreateNFTRequest, NFTMetadata>(
  { expose: true, method: "POST", path: "/nft/nfts" },
  async (req) => {
    // Simple validation
    if (!req.tokenId || !req.tokenNumber || !req.ownerAddress) {
      throw new Error("tokenId, tokenNumber, and ownerAddress are required");
    }
    const nft = await nftDB.queryRow<NFTMetadata>`
      INSERT INTO nft_metadata (
        token_id,
        token_number,
        name,
        description,
        image_url,
        animation_url,
        external_url,
        attributes,
        owner_address
      )
      VALUES (
        ${req.tokenId},
        ${req.tokenNumber},
        ${req.name || null},
        ${req.description || null},
        ${req.imageUrl || null},
        ${req.animationUrl || null},
        ${req.externalUrl || null},
        ${req.attributes ? JSON.stringify(req.attributes) : null},
        ${req.ownerAddress}
      )
      RETURNING 
        id,
        token_id as "tokenId",
        token_number::text as "tokenNumber",
        name,
        description,
        image_url as "imageUrl",
        animation_url as "animationUrl",
        external_url as "externalUrl",
        attributes::text as attributes,
        owner_address as "ownerAddress",
        created_at as "createdAt",
        updated_at as "updatedAt"
    `;
    return {
      ...nft!,
      attributes: parseAttributes(nft!.attributes)
    };
  }
);

// List marketplace items
export const listMarketplace = api<void, ListMarketplaceResponse>(
  { expose: true, method: "GET", path: "/nft/marketplace" },
  async () => {
    const listings = await nftDB.queryAll<MarketplaceListing>`
      SELECT 
        ml.id,
        ml.token_id as "tokenId",
        ml.token_number::text as "tokenNumber",
        ml.seller_address as "sellerAddress",
        ml.price::text as price,
        ml.currency_token_id as "currencyTokenId",
        ml.status,
        ml.expires_at as "expiresAt",
        ml.created_at as "createdAt",
        ml.sold_at as "soldAt",
        ml.buyer_address as "buyerAddress",
        nm.name as "nftName",
        nm.image_url as "nftImage"
      FROM marketplace_listings ml
      LEFT JOIN nft_metadata nm ON ml.token_id = nm.token_id AND ml.token_number = nm.token_number
      WHERE ml.status = 'active'
      ORDER BY ml.created_at DESC
    `;
    return { listings };
  }
);

// Create marketplace listing
export const createListing = api<CreateListingRequest, MarketplaceListing>(
  { expose: true, method: "POST", path: "/nft/marketplace/list" },
  async (req) => {
    // Validate required fields
    if (!req.tokenId || !req.tokenNumber || !req.sellerAddress || !req.price) {
      throw new Error("tokenId, tokenNumber, sellerAddress, and price are required");
    }
    // Verify NFT ownership
    const nft = await nftDB.queryRow<{ owner_address: string }>`
      SELECT owner_address 
      FROM nft_metadata 
      WHERE token_id = ${req.tokenId} AND token_number = ${req.tokenNumber}
    `;
    if (!nft) {
      throw new Error("NFT not found");
    }
    if (nft.owner_address !== req.sellerAddress) {
      throw new Error("You don't own this NFT");
    }
    const listing = await nftDB.queryRow<MarketplaceListing>`
      INSERT INTO marketplace_listings (
        token_id,
        token_number,
        seller_address,
        price,
        currency_token_id,
        expires_at
      )
      VALUES (
        ${req.tokenId},
        ${req.tokenNumber},
        ${req.sellerAddress},
        ${req.price},
        ${req.currencyTokenId || null},
        ${req.expiresAt || null}
      )
      RETURNING 
        id,
        token_id as "tokenId",
        token_number::text as "tokenNumber",
        seller_address as "sellerAddress",
        price::text as price,
        currency_token_id as "currencyTokenId",
        status,
        expires_at as "expiresAt",
        created_at as "createdAt",
        sold_at as "soldAt",
        buyer_address as "buyerAddress"
    `;
    return listing!;
  }
);

// Buy NFT from marketplace
export const buyNFT = api<BuyNFTRequest, { success: boolean; message: string; transactionHash?: string }>(
  { expose: true, method: "POST", path: "/nft/marketplace/buy" },
  async (req) => {
    // Validate request
    if (!req.listingId || !req.buyerAddress) {
      throw new Error("listingId and buyerAddress are required");
    }
    // Get listing details
    const listing = await nftDB.queryRow<any>`
      SELECT * FROM marketplace_listings 
      WHERE id = ${req.listingId} AND status = 'active'
    `;
    if (!listing) {
      throw new Error("Listing not found or no longer active");
    }
    // Check if listing has expired
    if (listing.expires_at && new Date() > listing.expires_at) {
      throw new Error("Listing has expired");
    }
    // Start transaction
    await nftDB.exec`BEGIN`;
    try {
      // Update listing status
      await nftDB.exec`
        UPDATE marketplace_listings 
        SET status = 'sold', sold_at = NOW(), buyer_address = ${req.buyerAddress}
        WHERE id = ${req.listingId}
      `;
      // Transfer NFT ownership
      await nftDB.exec`
        UPDATE nft_metadata 
        SET owner_address = ${req.buyerAddress}, updated_at = NOW()
        WHERE token_id = ${listing.token_id} AND token_number = ${listing.token_number}
      `;
      await nftDB.exec`COMMIT`;
      // Generate mock transaction hash
      const mockTxHash = '0x' + Math.random().toString(16).padStart(64, '0').slice(0, 64);
      return {
        success: true,
        message: "NFT purchased successfully",
        transactionHash: mockTxHash
      };
    } catch (error) {
      await nftDB.exec`ROLLBACK`;
      throw error;
    }
  }
);

// Cancel marketplace listing
export const cancelListing = api<{ listingId: number; sellerAddress: string }, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/nft/marketplace/cancel" },
  async (req) => {
    if (!req.listingId || !req.sellerAddress) {
      throw new Error("listingId and sellerAddress are required");
    }
    const result = await nftDB.queryRow<{ id: number }>`
      UPDATE marketplace_listings 
      SET status = 'cancelled'
      WHERE id = ${req.listingId} 
        AND seller_address = ${req.sellerAddress} 
        AND status = 'active'
      RETURNING id
    `;
    if (!result) {
      throw new Error("Listing not found or you're not the seller");
    }
    return {
      success: true,
      message: "Listing cancelled successfully"
    };
  }
);
