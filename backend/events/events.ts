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

/**
 * Helper to parse eventData safely.
 */
function parseEventData(raw: any): any {
  if (!raw) return {};
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw as string);
  } catch {
    return {};
  }
}

/**
 * Helper to build WHERE clause and params for queries.
 */
function buildWhereClause(filters: Record<string, any>, startParamIdx = 1): { clause: string; params: any[] } {
  let clause = "WHERE 1=1";
  const params: any[] = [];
  let idx = startParamIdx;
  for (const key in filters) {
    if (filters[key] !== undefined && filters[key] !== null) {
      clause += ` AND ${key} = $${idx}`;
      params.push(filters[key]);
      idx++;
    }
  }
  return { clause, params };
}

/**
 * List blockchain events with filtering
 */
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
    const page = Math.max(1, req.page ?? 1);
    const limit = Math.min(100, req.limit ?? 50);
    const offset = (page - 1) * limit;

    // Build dynamic where clause and params
    const { clause: whereClause, params } = buildWhereClause({
      contract_address: req.contractAddress,
      event_name: req.eventName,
      network_id: req.networkId,
      block_number: req.blockNumber,
    });

    // For pagination, next param indices
    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

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
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const allParams = [...params, limit, offset];
    const events = await eventsDB.rawQueryAll<BlockchainEvent>(query, ...allParams);

    // Get total count (do not include limit/offset params)
    const countQuery = `SELECT COUNT(*) as count FROM blockchain_events ${whereClause}`;
    const countResult = await eventsDB.rawQueryRow<{ count: number }>(countQuery, ...params);

    const processedEvents = events.map(event => ({
      ...event,
      eventData: parseEventData(event.eventData)
    }));

    return {
      events: processedEvents,
      total: countResult?.count || 0
    };
  }
);

/**
 * Get specific event by ID
 */
export const getEvent = api<{ id: number }, BlockchainEvent>(
  { expose: true, method: "GET", path: "/events/events/:id" },
  async ({ id }) => {
    if (!id || isNaN(id)) throw new Error("Invalid event ID");
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
    if (!event) throw new Error("Event not found");
    return {
      ...event,
      eventData: parseEventData(event.eventData)
    };
  }
);

/**
 * Create a new blockchain event
 */
export const createEvent = api<CreateEventRequest, BlockchainEvent>(
  { expose: true, method: "POST", path: "/events/events" },
  async (req) => {
    // Validate required fields
    for (const key of [
      "transactionHash", "contractAddress", "eventName", "eventData", "blockNumber", "logIndex", "networkId"
    ]) {
      if (!(key in req)) throw new Error(`Missing field: ${key}`);
    }

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

    if (!event) throw new Error("Failed to create event");

    const processedEvent = {
      ...event,
      eventData: parseEventData(event.eventData)
    };

    broadcastEvent({
      type: 'event',
      data: processedEvent,
      timestamp: new Date()
    });

    return processedEvent;
  }
);

/**
 * Get events by transaction hash
 */
export const getEventsByTransaction = api<{ transactionHash: string }, ListEventsResponse>(
  { expose: true, method: "GET", path: "/events/transaction/:transactionHash" },
  async ({ transactionHash }) => {
    if (!transactionHash) throw new Error("Missing transactionHash");
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
      eventData: parseEventData(event.eventData)
    }));
    return {
      events: processedEvents,
      total: events.length
    };
  }
);

/**
 * Get events by contract address
 */
export const getEventsByContract = api<{
  contractAddress: string;
  eventName?: string;
  page?: number;
  limit?: number;
}, ListEventsResponse>(
  { expose: true, method: "GET", path: "/events/contract/:contractAddress" },
  async (req) => {
    if (!req.contractAddress) throw new Error("Missing contractAddress");
    const page = Math.max(1, req.page ?? 1);
    const limit = Math.min(100, req.limit ?? 50);
    const offset = (page - 1) * limit;

    // Build dynamic where clause
    const { clause: whereClause, params } = buildWhereClause({
      contract_address: req.contractAddress,
      event_name: req.eventName,
    });

    const limitIdx = params.length + 1;
    const offsetIdx = params.length + 2;

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
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const allParams = [...params, limit, offset];
    const events = await eventsDB.rawQueryAll<BlockchainEvent>(query, ...allParams);

    // Get count
    const countQuery = `SELECT COUNT(*) as count FROM blockchain_events ${whereClause}`;
    const countResult = await eventsDB.rawQueryRow<{ count: number }>(countQuery, ...params);

    const processedEvents = events.map(event => ({
      ...event,
      eventData: parseEventData(event.eventData)
    }));

    return {
      events: processedEvents,
      total: countResult?.count || 0
    };
  }
);

/**
 * Real-time event streaming endpoint
 */
export const eventStream = api.streamOut<EventSubscription, RealtimeEvent>(
  { expose: true, path: "/events/stream" },
  async (subscription, stream) => {
    connectedStreams.add(stream);

    try {
      // Send recent events to new subscriber based on filters (last 1 hour)
      const { clause: whereClause, params } = buildWhereClause({
        contract_address: subscription.contractAddress,
        event_name: subscription.eventName,
        network_id: subscription.networkId
      });

      // Add recent time filter
      const timeClause = `${whereClause} AND created_at >= NOW() - INTERVAL '1 hour'`;

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
        ${timeClause}
        ORDER BY created_at DESC
        LIMIT 10
      `;

      const recentEvents = await eventsDB.rawQueryAll<BlockchainEvent>(query, ...params);

      for (const event of recentEvents) {
        await stream.send({
          type: 'event',
          data: { ...event, eventData: parseEventData(event.eventData) },
          timestamp: event.createdAt
        });
      }

      // Keep connection alive
      const keepAlive = setInterval(() => {}, 30000);

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

/**
 * Broadcast events to all connected clients
 */
export function broadcastEvent(event: RealtimeEvent) {
  for (const stream of connectedStreams) {
    stream.send(event).catch(() => {
      connectedStreams.delete(stream);
    });
  }
}

/**
 * Simulate blockchain events (for testing purposes)
 */
export const simulateEvent = api<{
  contractAddress: string;
  eventName: string;
  eventData: any;
  networkId: number;
}, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/events/simulate" },
  async (req) => {
    for (const key of ["contractAddress", "eventName", "eventData", "networkId"]) {
      if (!(key in req)) throw new Error(`Missing field: ${key}`);
    }
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
