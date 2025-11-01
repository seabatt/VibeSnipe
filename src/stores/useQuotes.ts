import { create } from 'zustand';
import { quoteBus } from '@/lib/quoteBus';

type QuoteMsg = { symbol: string; last: number; bid?: number; ask?: number; ts: number };

interface QuotesStore {
  quotes: Map<string, QuoteMsg>;
  subscribe: (symbols: string[]) => void;
  unsubscribe: () => void;
  getQuote: (symbol: string) => QuoteMsg | undefined;
}

export const useQuotes = create<QuotesStore>((set, get) => {
  const unsubscribeFns: (() => void)[] = [];

  return {
    quotes: new Map(),
    subscribe: (symbols: string[]) => {
      // Cleanup existing subscriptions
      get().unsubscribe();

      const newFns = symbols.map((symbol) => {
        return quoteBus.onQuote(symbol, (msg: QuoteMsg) => {
          set((state) => {
            const newQuotes = new Map(state.quotes);
            newQuotes.set(symbol, msg);
            return { quotes: newQuotes };
          });
        });
      });

      quoteBus.start(symbols);
      unsubscribeFns.push(...newFns);
    },
    unsubscribe: () => {
      unsubscribeFns.forEach((fn) => fn());
      unsubscribeFns.length = 0;
      quoteBus.stop();
    },
    getQuote: (symbol: string) => get().quotes.get(symbol),
  };
});
