import { api, StreamOut } from "encore.dev/api";
import { SQLDatabase } from "encore.dev/storage/sqldb";

const eventsDB = SQLDatabase.named("blockchain");

export interface BlockchainEvent {
  id: number;
  transactionHash: string;
  contractAddress: string;
  eventName: string;
  eventData: any;
  blockNumber: number;
  logIndex: number;
  networkId: number;
  createdAt: Date;
}

export interface CreateEventRequest {
  transactionHash: string;
  contractAddress: string;
  eventName: string;
  eventData: any;
  blockNumber: number;
  logIndex: number;
  networkId: number;
}

export interface EventSubscription {
  contractAddress?: string;
  eventName?: string;
  networkId?: number;
}

export interface RealtimeEvent {
  type: 'transaction' | 'event' | 'block';
  data: any;
  timestamp: Date;
}

export interface ListEventsResponse {
  events: BlockchainEvent[];
  total: number;
}

// Connected clients for real-time updates
const connectedStreams: Set<StreamOut<RealtimeEvent>> = new Set();

// List blockchain events with filtering
export const listEvents = api<{
  page?: number;
  limit?: number;
  contractAddress?: string;
  eventName?: string;
  networkId?: number;
  blockNumber?: number;
}, ListEventsResponse>(
  { expose: true, method: "GET", path: "/events/events" },
  async (req) => {
    const page = req.page || 1;
    const limit = req.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    let paramIndex = 1;

    if (req.contractAddress) {
      whereClause += ` AND contract_address = $${paramIndex}`;
      params.push(req.contractAddress);
      paramIndex++;
    }
    
    if (req.eventName) {
      whereClause += ` AND event_name = $${paramIndex}`;
      params.push(req.eventName);
      paramIndex++;
    }
    
    if (req.networkId) {
      whereClause += ` AND network_id = $${paramIndex}`;
      params.push(req.networkId);
      paramIndex++;
    }
    
    if (req.blockNumber) {
      whereClause += ` AND block_number = $${paramIndex}`;
      params.push(req.blockNumber);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        transaction_hash as "transactionHash",
        contract_address as "contractAddress",
        event_name as "eventName",
        event_data::text as "eventData",
        block_number as "blockNumber",
        log_index as "logIndex",
        network_id as "networkId",
        created_at as "createdAt"
      FROM blockchain_events 
      ${whereClause}
      ORDER BY block_number DESC, log_index DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const events = await eventsDB.rawQueryAll<BlockchainEvent>(query, ...params);
    
    // Get total count
    const countQuery = `SELECT COUNT(*) as count FROM blockchain_events ${whereClause}`;
    const countParams = params.slice(0, -2);
    const countResult = await eventsDB.rawQueryRow<{ count: number }>(countQuery, ...countParams);
    
    // Parse event data JSON
    const processedEvents = events.map(event => ({
      ...event,
      eventData: event.eventData ? JSON.parse(event.eventData as string) : {}
    }));
    
    return {
      events: processedEvents,
      total: countResult?.count || 0
    };
  }
);

// Get specific event by ID
export const getEvent = api<{ id: number }, BlockchainEvent>(
  { expose: true, method: "GET", path: "/events/events/:id" },
  async ({ id }) => {
    const event = await eventsDB.queryRow<BlockchainEvent>`
      SELECT 
        id,
        transaction_hash as "transactionHash",
        contract_address as "contractAddress",
        event_name as "eventName",
        event_data::text as "eventData",
        block_number as "blockNumber",
        log_index as "logIndex",
        network_id as "networkId",
        created_at as "createdAt"
      FROM blockchain_events 
      WHERE id = ${id}
    `;
    
    if (!event) {
      throw new Error("Event not found");
    }
    
    return {
      ...event,
      eventData: event.eventData ? JSON.parse(event.eventData as string) : {}
    };
  }
);

// Create a new blockchain event
export const createEvent = api<CreateEventRequest, BlockchainEvent>(
  { expose: true, method: "POST", path: "/events/events" },
  async (req) => {
    const event = await eventsDB.queryRow<BlockchainEvent>`
      INSERT INTO blockchain_events (
        transaction_hash,
        contract_address,
        event_name,
        event_data,
        block_number,
        log_index,
        network_id
      )
      VALUES (
        ${req.transactionHash},
        ${req.contractAddress},
        ${req.eventName},
        ${JSON.stringify(req.eventData)},
        ${req.blockNumber},
        ${req.logIndex},
        ${req.networkId}
      )
      RETURNING 
        id,
        transaction_hash as "transactionHash",
        contract_address as "contractAddress",
        event_name as "eventName",
        event_data::text as "eventData",
        block_number as "blockNumber",
        log_index as "logIndex",
        network_id as "networkId",
        created_at as "createdAt"
    `;
    
    const processedEvent = {
      ...event!,
      eventData: JSON.parse(event!.eventData as string)
    };

    // Broadcast to connected clients
    broadcastEvent({
      type: 'event' as const,
      data: processedEvent,
      timestamp: new Date()
    });
    
    return processedEvent;
  }
);

// Get events by transaction hash
export const getEventsByTransaction = api<{ transactionHash: string }, ListEventsResponse>(
  { expose: true, method: "GET", path: "/events/transaction/:transactionHash" },
  async ({ transactionHash }) => {
    const events = await eventsDB.queryAll<BlockchainEvent>`
      SELECT 
        id,
        transaction_hash as "transactionHash",
        contract_address as "contractAddress",
        event_name as "eventName",
        event_data::text as "eventData",
        block_number as "blockNumber",
        log_index as "logIndex",
        network_id as "networkId",
        created_at as "createdAt"
      FROM blockchain_events 
      WHERE transaction_hash = ${transactionHash}
      ORDER BY log_index ASC
    `;
    
    const processedEvents = events.map(event => ({
      ...event,
      eventData: event.eventData ? JSON.parse(event.eventData as string) : {}
    }));
    
    return {
      events: processedEvents,
      total: events.length
    };
  }
);

// Get events by contract address
export const getEventsByContract = api<{
  contractAddress: string;
  eventName?: string;
  page?: number;
  limit?: number;
}, ListEventsResponse>(
  { expose: true, method: "GET", path: "/events/contract/:contractAddress" },
  async (req) => {
    const page = req.page || 1;
    const limit = req.limit || 50;
    const offset = (page - 1) * limit;
    
    let whereClause = "WHERE contract_address = $1";
    const params: any[] = [req.contractAddress];
    let paramIndex = 2;

    if (req.eventName) {
      whereClause += ` AND event_name = $${paramIndex}`;
      params.push(req.eventName);
      paramIndex++;
    }

    const query = `
      SELECT 
        id,
        transaction_hash as "transactionHash",
        contract_address as "contractAddress",
        event_name as "eventName",
        event_data::text as "eventData",
        block_number as "blockNumber",
        log_index as "logIndex",
        network_id as "networkId",
        created_at as "createdAt"
      FROM blockchain_events 
      ${whereClause}
      ORDER BY block_number DESC, log_index DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    
    params.push(limit, offset);
    const events = await eventsDB.rawQueryAll<BlockchainEvent>(query, ...params);
    
    const countQuery = `SELECT COUNT(*) as count FROM blockchain_events ${whereClause}`;
    const countParams = params.slice(0, -2);
    const countResult = await eventsDB.rawQueryRow<{ count: number }>(countQuery, ...countParams);
    
    const processedEvents = events.map(event => ({
      ...event,
      eventData: event.eventData ? JSON.parse(event.eventData as string) : {}
    }));
    
    return {
      events: processedEvents,
      total: countResult?.count || 0
    };
  }
);

// Real-time event streaming endpoint
export const eventStream = api.streamOut<EventSubscription, RealtimeEvent>(
  { expose: true, path: "/events/stream" },
  async (subscription, stream) => {
    connectedStreams.add(stream);
    
    try {
      // Send recent events to new subscriber based on subscription filters
      let whereClause = "WHERE created_at >= NOW() - INTERVAL '1 hour'";
      const params: any[] = [];
      let paramIndex = 1;

      if (subscription.contractAddress) {
        whereClause += ` AND contract_address = $${paramIndex}`;
        params.push(subscription.contractAddress);
        paramIndex++;
      }
      
      if (subscription.eventName) {
        whereClause += ` AND event_name = $${paramIndex}`;
        params.push(subscription.eventName);
        paramIndex++;
      }
      
      if (subscription.networkId) {
        whereClause += ` AND network_id = $${paramIndex}`;
        params.push(subscription.networkId);
        paramIndex++;
      }

      const query = `
        SELECT 
          id,
          transaction_hash as "transactionHash",
          contract_address as "contractAddress",
          event_name as "eventName",
          event_data::text as "eventData",
          block_number as "blockNumber",
          log_index as "logIndex",
          network_id as "networkId",
          created_at as "createdAt"
        FROM blockchain_events 
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const recentEvents = await eventsDB.rawQueryAll<BlockchainEvent>(query, ...params);
      
      for (const event of recentEvents) {
        await stream.send({
          type: 'event',
          data: {
            ...event,
            eventData: event.eventData ? JSON.parse(event.eventData as string) : {}
          },
          timestamp: event.createdAt
        });
      }

      // Keep connection alive
      const keepAlive = setInterval(() => {
        // Connection is kept alive by the framework
      }, 30000);

      // Wait for client to disconnect
      await new Promise((resolve) => {
        stream.onClose = () => {
          clearInterval(keepAlive);
          resolve(void 0);
        };
      });
    } finally {
      connectedStreams.delete(stream);
    }
  }
);

// Helper function to broadcast events to all connected clients
export function broadcastEvent(event: RealtimeEvent) {
  for (const stream of connectedStreams) {
    try {
      stream.send(event).catch(() => {
        // If send fails, remove the stream
        connectedStreams.delete(stream);
      });
    } catch (err) {
      connectedStreams.delete(stream);
    }
  }
}

// Simulate blockchain events (for testing purposes)
export const simulateEvent = api<{
  contractAddress: string;
  eventName: string;
  eventData: any;
  networkId: number;
}, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/events/simulate" },
  async (req) => {
    const mockTxHash = '0x' + Math.random().toString(16).substr(2, 64);
    const mockBlockNumber = Math.floor(Math.random() * 1000000) + 18000000;
    
    await createEvent({
      transactionHash: mockTxHash,
      contractAddress: req.contractAddress,
      eventName: req.eventName,
      eventData: req.eventData,
      blockNumber: mockBlockNumber,
      logIndex: 0,
      networkId: req.networkId
    });

    return {
      success: true,
      message: "Event simulated successfully"
    };
  }
);
