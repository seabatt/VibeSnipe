import { create } from 'zustand';
import { subscribeQuotes } from '@/lib/tastytrade/marketData';
import type { GreekQuote } from '@/lib/tastytrade/types';
import { logger } from '@/lib/logger';

type QuoteMsg = { symbol: string; last: number; bid?: number; ask?: number; ts: number };

interface QuotesStore {
  quotes: Map<string, QuoteMsg>;
  eventSource: EventSource | null;
  currentSymbols: string[];
  subscribe: (symbols: string[]) => void;
  unsubscribe: () => void;
  getQuote: (symbol: string) => QuoteMsg | undefined;
}

/**
 * Maps GreekQuote from SSE to QuoteMsg format for compatibility.
 */
function mapGreekQuoteToQuoteMsg(greekQuote: GreekQuote): QuoteMsg {
  return {
    symbol: greekQuote.symbol,
    last: greekQuote.mark, // Use mark as last price
    bid: greekQuote.bid,
    ask: greekQuote.ask,
    ts: greekQuote.timestamp 
      ? new Date(greekQuote.timestamp).getTime() 
      : Date.now(),
  };
}

export const useQuotes = create<QuotesStore>((set, get) => ({
  quotes: new Map(),
  eventSource: null,
  currentSymbols: [],
  subscribe: async (symbols: string[]) => {
      // Cleanup existing subscriptions
      get().unsubscribe();

      // Subscribe to quotes on the backend
      try {
        await subscribeQuotes(symbols);
      } catch (error) {
        logger.error('Failed to subscribe to quotes', { symbols }, error as Error);
      }

      // Build SSE URL with symbols query parameter
      const symbolsParam = symbols.join(',');
      const url = `/api/tastytrade/stream/quotes?symbols=${encodeURIComponent(symbolsParam)}`;

      // Create EventSource connection
      const newEventSource = new EventSource(url);
      set({ eventSource: newEventSource, currentSymbols: symbols });

      // Handle quote events
      newEventSource.addEventListener('quote', (event: MessageEvent) => {
        try {
          const greekQuote: GreekQuote = JSON.parse(event.data);
          const quoteMsg = mapGreekQuoteToQuoteMsg(greekQuote);
          
          set((state) => {
            const newQuotes = new Map(state.quotes);
            newQuotes.set(quoteMsg.symbol, quoteMsg);
            return { quotes: newQuotes };
          });
        } catch (error) {
          logger.error('Error parsing quote event', undefined, error as Error);
        }
      });

      // Handle connection events
      newEventSource.addEventListener('connected', (event: MessageEvent) => {
        logger.info('Quote stream connected', { data: event.data });
      });

      // Handle errors (network/connection errors)
      newEventSource.onerror = (event) => {
        logger.error('Quote stream connection error', { event });
        // EventSource will automatically attempt to reconnect
      };

      // Handle custom error events from server
      newEventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const errorData = JSON.parse(event.data);
          logger.error('Quote stream server error', { error: errorData });
        } catch (e) {
          // Ignore parse errors
        }
      });
    },
    unsubscribe: () => {
      const { eventSource } = get();
      
      // Close EventSource connection
      if (eventSource) {
        eventSource.close();
        set({ eventSource: null, currentSymbols: [] });
      }
    },
    getQuote: (symbol: string) => get().quotes.get(symbol),
  }));
