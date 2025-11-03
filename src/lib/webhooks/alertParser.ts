/**
 * Centralized TastyTrade alert parser
 * Handles Discord webhooks and paste-based alert ingestion
 */

export interface ParsedAlert {
  underlying: 'SPX' | 'QQQ' | 'SPY' | 'RUT' | 'NDX' | 'AAPL' | 'TSLA';
  strategy: 'Vertical' | 'Butterfly' | 'Iron Condor';
  direction: 'CALL' | 'PUT';
  longStrike: number;
  shortStrike: number;
  wingStrike?: number;
  limitPrice: number;
  width: number;
  expiry?: string; // ISO date string (YYYY-MM-DD) or undefined for 0DTE
}

/**
 * Parse TastyTrade-format alert text
 * 
 * Format: "SELL -1 Vertical SPX 100 31 Oct 25 6855/6860 CALL @0.3 LMT"
 * 
 * @param text - Raw alert text from Discord or copy-paste
 * @returns Parsed alert data or null if invalid
 */
export function parseTastyTradeAlert(text: string): ParsedAlert | null {
  // Extract underlying (including NDX, AAPL, TSLA for 8Ball)
  const underlyingMatch = text.match(/\b(SPX|QQQ|SPY|RUT|NDX|AAPL|TSLA)\b/i);
  if (!underlyingMatch) return null;
  const underlying = underlyingMatch[1].toUpperCase() as ParsedAlert['underlying'];
  
  // Extract strategy
  const isVertical = /vertical/i.test(text);
  const isButterfly = /butterfly|fly/i.test(text);
  const isSonar = /sonar|iron.condor/i.test(text);
  if (!isVertical && !isButterfly && !isSonar) return null;
  
  // Extract direction
  const directionMatch = text.match(/\b(CALL|PUT)S?\b/i);
  const direction = (directionMatch?.[1]?.toUpperCase() as 'CALL' | 'PUT') || 'CALL';
  
  // Extract strikes (e.g., "6860/6865" or "6850/6860/6870")
  const strikesMatch = text.match(/(\d+)\/(\d+)(?:\/(\d+))?/);
  if (!strikesMatch) return null;
  const longStrike = parseInt(strikesMatch[1]);
  const shortStrike = parseInt(strikesMatch[2]);
  const wingStrike = strikesMatch[3] ? parseInt(strikesMatch[3]) : undefined;
  
  // Extract price
  const priceMatch = text.match(/@(\d+\.?\d*)/);
  if (!priceMatch) return null;
  const limitPrice = parseFloat(priceMatch[1]);
  
  // Extract expiry date (e.g., "31 Oct 25" or "15 DEC 24")
  const expiryMatch = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})/i);
  let expiry: string | undefined;
  if (expiryMatch) {
    const day = parseInt(expiryMatch[1]);
    const monthNames: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthNames[expiryMatch[2].toLowerCase()];
    let year = parseInt(expiryMatch[3]);
    if (year < 100) year += 2000; // Convert 2-digit to 4-digit year
    const expiryDate = new Date(year, month, day);
    expiry = expiryDate.toISOString().split('T')[0];
  }
  // If no expiry specified, leave undefined (will default to 0DTE elsewhere)
  
  // Determine strategy type
  let strategy: ParsedAlert['strategy'];
  if (isSonar) {
    strategy = 'Iron Condor';
  } else if (isButterfly) {
    strategy = 'Butterfly';
  } else {
    strategy = 'Vertical';
  }
  
  return {
    underlying,
    strategy,
    direction,
    longStrike,
    shortStrike,
    wingStrike,
    limitPrice,
    width: shortStrike - longStrike,
    expiry,
  };
}

