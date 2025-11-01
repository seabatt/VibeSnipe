import { EventEmitter } from "events";

type QuoteMsg = { symbol: string; last: number; bid?: number; ask?: number; ts: number };

export class QuoteBus extends EventEmitter {
  private timer?: ReturnType<typeof setInterval>;
  private prices = new Map<string, number>();

  start(symbols: string[]) {
    symbols.forEach(s => this.prices.set(s, this.prices.get(s) ?? (s === "SPX" ? 5100 : 450)));

    this.timer = setInterval(() => {
      symbols.forEach(s => {
        const base = this.prices.get(s)!;
        const drift = (Math.random() - 0.5) * 0.001;
        const next = +(base * (1 + drift)).toFixed(2);
        this.prices.set(s, next);
        const msg: QuoteMsg = { symbol: s, last: next, ts: Date.now() };
        this.emit(s, msg);
      });
    }, 500);
  }

  onQuote(symbol: string, cb: (q: QuoteMsg) => void) {
    this.on(symbol, cb);
    return () => this.off(symbol, cb);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

export const quoteBus = new QuoteBus();
