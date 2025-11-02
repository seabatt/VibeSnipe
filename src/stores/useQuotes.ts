import { create } from 'zustand';
import { subscribeQuotes } from '@/lib/tastytrade';
import type { GreekQuote } from '@/lib/tastytrade';

type QuoteMsg = { symbol: string; last: number; bid?: number; ask?: number; ts: number };

interface QuotesStore {
  quotes: Map<string, QuoteMsg>;
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

export const useQuotes = create<QuotesStore>((set, get) => {
  let eventSource: EventSource | null = null;
  let currentSymbols: string[] = [];

  return {
    quotes: new Map(),
    subscribe: async (symbols: string[]) => {
      // Cleanup existing subscriptions
      get().unsubscribe();

      // Update current symbols
      currentSymbols = symbols;

      // Subscribe to quotes on the backend
      try {
        await subscribeQuotes(symbols);
      } catch (error) {
        console.error('Failed to subscribe to quotes:', error);
      }

      // Build SSE URL with symbols query parameter
      const symbolsParam = symbols.join(',');
      const url = `/api/tastytrade/stream/quotes?symbols=${encodeURIComponent(symbolsParam)}`;

      // Create EventSource connection
      eventSource = new EventSource(url);

      // Handle quote events
      eventSource.addEventListener('quote', (event: MessageEvent) => {
        try {
          const greekQuote: GreekQuote = JSON.parse(event.data);
          const quoteMsg = mapGreekQuoteToQuoteMsg(greekQuote);
          
          set((state) => {
            const newQuotes = new Map(state.quotes);
            newQuotes.set(quoteMsg.symbol, quoteMsg);
            return { quotes: newQuotes };
          });
        } catch (error) {
          console.error('Error parsing quote event:', error);
        }
      });

      // Handle connection events
      eventSource.addEventListener('connected', (event: MessageEvent) => {
        console.log('Quote stream connected:', event.data);
      });

      // Handle errors (network/connection errors)
      eventSource.onerror = (event) => {
        console.error('Quote stream connection error:', event);
        // EventSource will automatically attempt to reconnect
      };

      // Handle custom error events from server
      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const errorData = JSON.parse(event.data);
          console.error('Quote stream server error:', errorData);
        } catch (e) {
          // Ignore parse errors
        }
      });
    },
    unsubscribe: () => {
      // Close EventSource connection
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      
      currentSymbols = [];
      
      // Clear quotes (optional - may want to keep last known quotes)
      // set({ quotes: new Map() });
    },
    getQuote: (symbol: string) => get().quotes.get(symbol),
  };
});
