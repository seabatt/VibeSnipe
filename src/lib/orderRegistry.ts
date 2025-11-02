/**
 * Order registry for fill confirmation and idempotency.
 * 
 * Tracks client-side order IDs to prevent duplicate submissions on retry.
 * Stores records in memory with optional localStorage persistence.
 * 
 * Key principle: Every order gets a unique client_order_id before submission.
 * Retries reuse the same ID, preventing broker-side duplicates.
 */

/**
 * Generate a unique ID for client-side order tracking.
 * 
 * @returns Unique UUID-like string
 */
function generateClientOrderId(): string {
  return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Order registration record.
 */
export interface OrderRecord {
  /** Unique client-side order ID */
  clientOrderId: string;
  /** Associated trade ID */
  tradeId: string;
  /** Current status */
  status: 'pending' | 'submitted' | 'confirmed' | 'duplicate' | 'failed';
  /** Timestamp when first submitted */
  submittedAt: string;
  /** Timestamp when confirmed by broker */
  confirmedAt?: string;
  /** Broker-assigned order ID */
  brokerOrderId?: string;
  /** Number of retry attempts */
  retryCount: number;
  /** Optional error message */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Order registry for tracking submissions and confirming fills.
 */
class OrderRegistryClass {
  /** In-memory store of order records */
  private orders: Map<string, OrderRecord> = new Map();
  
  /** Storage key for persistence */
  private readonly STORAGE_KEY = 'vibesnipe_order_registry';
  
  /** Maximum age of records to keep (24 hours) */
  private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000;

  /**
   * Initialize registry (load from localStorage if available).
   */
  constructor() {
    this.loadFromStorage();
    
    // Clean up old records on startup
    this.cleanup();
    
    // Periodic cleanup every hour
    setInterval(() => this.cleanup(), 60 * 60 * 1000);
  }

  /**
   * Load records from localStorage.
   */
  private loadFromStorage(): void {
    if (typeof window === 'undefined') {
      return; // Server-side, no localStorage
    }

    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const records: OrderRecord[] = JSON.parse(stored);
        for (const record of records) {
          this.orders.set(record.clientOrderId, record);
        }
      }
    } catch (error) {
      console.error('Failed to load order registry from storage:', error);
    }
  }

  /**
   * Save records to localStorage.
   */
  private saveToStorage(): void {
    if (typeof window === 'undefined') {
      return; // Server-side, no localStorage
    }

    try {
      const records = Array.from(this.orders.values());
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('Failed to save order registry to storage:', error);
    }
  }

  /**
   * Clean up old records.
   */
  private cleanup(): void {
    const now = Date.now();
    const cutoff = new Date(now - this.MAX_AGE_MS);

    for (const [id, record] of this.orders.entries()) {
      const submittedAt = new Date(record.submittedAt);
      if (submittedAt < cutoff) {
        this.orders.delete(id);
      }
    }

    this.saveToStorage();
  }

  /**
   * Generate a new client order ID.
   * 
   * @returns Unique client order ID
   */
  generateClientOrderId(): string {
    return generateClientOrderId();
  }

  /**
   * Check if an order has already been submitted.
   * 
   * @param clientOrderId - Client order ID to check
   * @returns True if already submitted
   */
  isSubmitted(clientOrderId: string): boolean {
    const record = this.orders.get(clientOrderId);
    return record?.status === 'submitted' || record?.status === 'confirmed';
  }

  /**
   * Get an order record by client order ID.
   * 
   * @param clientOrderId - Client order ID
   * @returns Order record or undefined
   */
  getOrder(clientOrderId: string): OrderRecord | undefined {
    return this.orders.get(clientOrderId);
  }

  /**
   * Record order submission.
   * 
   * @param record - Order record
   */
  recordSubmission(record: OrderRecord): void {
    this.orders.set(record.clientOrderId, record);
    this.saveToStorage();
  }

  /**
   * Mark order as submitted to broker.
   * 
   * @param clientOrderId - Client order ID
   * @param brokerOrderId - Broker-assigned order ID
   */
  confirmSubmission(clientOrderId: string, brokerOrderId: string): void {
    const record = this.orders.get(clientOrderId);
    if (!record) {
      throw new Error(`Order ${clientOrderId} not found in registry`);
    }

    record.status = 'confirmed';
    record.brokerOrderId = brokerOrderId;
    record.confirmedAt = new Date().toISOString();
    
    this.orders.set(clientOrderId, record);
    this.saveToStorage();
  }

  /**
   * Increment retry count for an order.
   * 
   * @param clientOrderId - Client order ID
   */
  incrementRetry(clientOrderId: string): void {
    const record = this.orders.get(clientOrderId);
    if (!record) {
      throw new Error(`Order ${clientOrderId} not found in registry`);
    }

    record.retryCount += 1;
    this.orders.set(clientOrderId, record);
    this.saveToStorage();
  }

  /**
   * Mark order as failed.
   * 
   * @param clientOrderId - Client order ID
   * @param error - Error message
   */
  markFailed(clientOrderId: string, error: string): void {
    const record = this.orders.get(clientOrderId);
    if (!record) {
      return; // Can't mark non-existent order as failed
    }

    record.status = 'failed';
    record.error = error;
    
    this.orders.set(clientOrderId, record);
    this.saveToStorage();
  }

  /**
   * Get all orders for a trade.
   * 
   * @param tradeId - Trade ID
   * @returns Array of order records
   */
  getOrdersByTrade(tradeId: string): OrderRecord[] {
    return Array.from(this.orders.values()).filter(o => o.tradeId === tradeId);
  }

  /**
   * Get all orders.
   * 
   * @returns Array of all order records
   */
  getAllOrders(): OrderRecord[] {
    return Array.from(this.orders.values());
  }

  /**
   * Clear all orders (for testing).
   */
  clear(): void {
    this.orders.clear();
    this.saveToStorage();
  }

  /**
   * Get statistics about the registry.
   * 
   * @returns Registry statistics
   */
  getStats(): {
    total: number;
    byStatus: Record<string, number>;
    avgRetryCount: number;
  } {
    const orders = Array.from(this.orders.values());
    const byStatus: Record<string, number> = {};
    let totalRetries = 0;

    for (const order of orders) {
      byStatus[order.status] = (byStatus[order.status] || 0) + 1;
      totalRetries += order.retryCount;
    }

    return {
      total: orders.length,
      byStatus,
      avgRetryCount: orders.length > 0 ? totalRetries / orders.length : 0,
    };
  }
}

/**
 * Singleton instance of order registry.
 */
export const orderRegistry = new OrderRegistryClass();

