import { pickShortByDelta, buildVertical } from '../chains';
import type { OptionInstrument } from '../types';

describe('chains', () => {
  const mockChain: OptionInstrument[] = [
    {
      symbol: 'SPX',
      strike: 5900,
      right: 'PUT',
      expiration: '2025-11-02',
      streamerSymbol: 'SPX_2025-11-02_5900P',
      delta: -0.50,
      bid: 10.5,
      ask: 11.0,
      mark: 10.75,
    },
    {
      symbol: 'SPX',
      strike: 5905,
      right: 'PUT',
      expiration: '2025-11-02',
      streamerSymbol: 'SPX_2025-11-02_5905P',
      delta: -0.45,
      bid: 9.0,
      ask: 9.5,
      mark: 9.25,
    },
    {
      symbol: 'SPX',
      strike: 5910,
      right: 'PUT',
      expiration: '2025-11-02',
      streamerSymbol: 'SPX_2025-11-02_5910P',
      delta: -0.40,
      bid: 7.5,
      ask: 8.0,
      mark: 7.75,
    },
    {
      symbol: 'SPX',
      strike: 5915,
      right: 'PUT',
      expiration: '2025-11-02',
      streamerSymbol: 'SPX_2025-11-02_5915P',
      delta: -0.30,
      bid: 5.0,
      ask: 5.5,
      mark: 5.25,
    },
    {
      symbol: 'SPX',
      strike: 5920,
      right: 'PUT',
      expiration: '2025-11-02',
      streamerSymbol: 'SPX_2025-11-02_5920P',
      delta: -0.20,
      bid: 3.0,
      ask: 3.5,
      mark: 3.25,
    },
  ];

  describe('pickShortByDelta', () => {
    it('should find contract closest to target delta', () => {
      const result = pickShortByDelta(mockChain, 0.30, 'PUT');
      expect(result).not.toBeNull();
      expect(result?.strike).toBe(5915);
      expect(result?.delta).toBe(-0.30);
    });

    it('should handle positive delta target for puts', () => {
      const result = pickShortByDelta(mockChain, 0.50, 'PUT');
      expect(result).not.toBeNull();
      expect(result?.strike).toBe(5900);
    });

    it('should handle negative delta target for puts', () => {
      const result = pickShortByDelta(mockChain, -0.30, 'PUT');
      expect(result).not.toBeNull();
      expect(result?.strike).toBe(5915);
    });

    it('should return closest match when exact delta not available', () => {
      const result = pickShortByDelta(mockChain, 0.35, 'PUT');
      expect(result).not.toBeNull();
      // Should return either 0.30 or 0.40 delta (closest)
      expect([5910, 5915]).toContain(result?.strike);
    });

    it('should return null for empty chain', () => {
      const result = pickShortByDelta([], 0.30, 'PUT');
      expect(result).toBeNull();
    });

    it('should return null when no contracts have delta', () => {
      const chainNoDelta = mockChain.map(c => ({ ...c, delta: undefined }));
      const result = pickShortByDelta(chainNoDelta, 0.30, 'PUT');
      expect(result).toBeNull();
    });

    it('should filter by right (CALL/PUT)', () => {
      const result = pickShortByDelta(mockChain, 0.30, 'CALL');
      expect(result).toBeNull(); // No calls in mock chain
    });

    it('should throw on invalid inputs', () => {
      expect(() => pickShortByDelta(mockChain, NaN, 'PUT')).toThrow();
      expect(() => pickShortByDelta(mockChain, 0.30, 'INVALID' as any)).toThrow();
    });
  });

  describe('buildVertical', () => {
    it('should build call vertical with correct strikes', () => {
      const shortLeg: OptionInstrument = {
        symbol: 'SPX',
        strike: 5900,
        right: 'CALL',
        expiration: '2025-11-02',
        streamerSymbol: 'SPX_2025-11-02_5900C',
        delta: 0.50,
      };

      const result = buildVertical(shortLeg, 10);
      
      expect(result).not.toBeNull();
      expect(result?.shortLeg.strike).toBe(5900);
      expect(result?.longLeg.strike).toBe(5910); // Call: long is higher
      expect(result?.longLeg.right).toBe('CALL');
    });

    it('should build put vertical with correct strikes', () => {
      const shortLeg: OptionInstrument = {
        symbol: 'SPX',
        strike: 5900,
        right: 'PUT',
        expiration: '2025-11-02',
        streamerSymbol: 'SPX_2025-11-02_5900P',
        delta: -0.50,
      };

      const result = buildVertical(shortLeg, 10);
      
      expect(result).not.toBeNull();
      expect(result?.shortLeg.strike).toBe(5900);
      expect(result?.longLeg.strike).toBe(5890); // Put: long is lower
      expect(result?.longLeg.right).toBe('PUT');
    });

    it('should throw on invalid width', () => {
      const shortLeg = mockChain[0];
      
      expect(() => buildVertical(shortLeg, 0)).toThrow();
      expect(() => buildVertical(shortLeg, -5)).toThrow();
      expect(() => buildVertical(shortLeg, NaN)).toThrow();
    });

    it('should throw on invalid short leg', () => {
      expect(() => buildVertical(null as any, 10)).toThrow();
      expect(() => buildVertical(undefined as any, 10)).toThrow();
    });

    it('should preserve expiration and symbol', () => {
      const shortLeg = mockChain[0];
      const result = buildVertical(shortLeg, 5);
      
      expect(result?.longLeg.symbol).toBe(shortLeg.symbol);
      expect(result?.longLeg.expiration).toBe(shortLeg.expiration);
    });
  });
});

