import { parseTastyTradeAlert } from '../alertParser';

describe('parseTastyTradeAlert - Shared Alert Parser', () => {
  describe('Expiry Date Parsing', () => {
    it('should parse 2-digit year (31 Oct 25)', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 100 31 Oct 25 6855/6860 CALL @0.3 LMT');
      
      expect(result).not.toBeNull();
      expect(result?.expiry).toBe('2025-10-31');
    });

    it('should parse 4-digit year (15 DEC 2024)', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical QQQ 15 DEC 2024 5900/5910 PUT @2.50 LMT');
      
      expect(result).not.toBeNull();
      expect(result?.expiry).toBe('2024-12-15');
    });

    it('should parse case-insensitive month names', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 23 jan 25 6855/6860 CALL @0.3 LMT');
      
      expect(result).not.toBeNull();
      expect(result?.expiry).toBe('2025-01-23');
    });

    it('should default to undefined for 0DTE (no expiry date)', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 6855/6860 CALL @0.3 LMT');
      
      expect(result).not.toBeNull();
      expect(result?.expiry).toBeUndefined();
    });
  });

  describe('Standard TastyTrade Format', () => {
    it('should parse complete SPX vertical alert', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 100 31 Oct 25 6855/6860 CALL @0.3 LMT');
      
      expect(result).toEqual({
        underlying: 'SPX',
        strategy: 'Vertical',
        direction: 'CALL',
        longStrike: 6855,
        shortStrike: 6860,
        limitPrice: 0.3,
        width: 5,
        expiry: '2025-10-31',
      });
    });

    it('should parse QQQ put spread alert', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical QQQ 515/520 PUT @1.45 LMT');
      
      expect(result).toEqual({
        underlying: 'QQQ',
        strategy: 'Vertical',
        direction: 'PUT',
        longStrike: 515,
        shortStrike: 520,
        limitPrice: 1.45,
        width: 5,
        expiry: undefined,
      });
    });

    it('should parse butterfly with 3 strikes', () => {
      const result = parseTastyTradeAlert('BUY -1 Butterfly QQQ 15 Jan 25 515/520/525 PUT @1.45 LMT');
      
      expect(result).toEqual({
        underlying: 'QQQ',
        strategy: 'Butterfly',
        direction: 'PUT',
        longStrike: 515,
        shortStrike: 520,
        wingStrike: 525,
        limitPrice: 1.45,
        width: 5,
        expiry: '2025-01-15',
      });
    });

    it('should parse iron condor variant', () => {
      const result = parseTastyTradeAlert('SELL -1 Iron Condor SPX 31 Oct 25 5850/5860/5900/5910 CALL @0.50 LMT');
      
      expect(result).toEqual({
        underlying: 'SPX',
        strategy: 'Iron Condor',
        direction: 'CALL',
        longStrike: 5850,
        shortStrike: 5860,
        wingStrike: 5900,
        limitPrice: 0.5,
        width: 10,
        expiry: '2025-10-31',
      });
    });
  });

  describe('Price Parsing', () => {
    it('should handle integer prices', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 6855/6860 CALL @1 LMT');
      expect(result?.limitPrice).toBe(1);
    });

    it('should handle decimal prices', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 6855/6860 CALL @0.30 LMT');
      expect(result?.limitPrice).toBe(0.3);
    });

    it('should handle multi-digit decimals', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 6855/6860 CALL @2.50 LMT');
      expect(result?.limitPrice).toBe(2.5);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-digit day', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 3 Oct 25 6855/6860 CALL @0.3 LMT');
      expect(result?.expiry).toBe('2025-10-03');
    });

    it('should handle February 29 in leap year', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 29 Feb 24 6855/6860 CALL @0.3 LMT');
      expect(result?.expiry).toBe('2024-02-29');
    });

    it('should handle invalid underlying', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical INVALID 6855/6860 CALL @0.3 LMT');
      expect(result).toBeNull();
    });

    it('should handle missing strikes', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX CALL @0.3 LMT');
      expect(result).toBeNull();
    });

    it('should handle missing price', () => {
      const result = parseTastyTradeAlert('SELL -1 Vertical SPX 6855/6860 CALL LMT');
      expect(result).toBeNull();
    });
  });
});

