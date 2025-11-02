import {
  validateAccountRisk,
  validateTimeWindow,
  validateChaseAttempts,
  validateCreditFloor,
  shouldExitByTime,
  shouldExitByDelta,
  calculateMaxContracts,
  TRADING_WINDOWS,
  MAX_SHORT_DELTA,
} from '../riskRules';
import { RiskRuleViolationError, TimeWindowViolationError } from '../errors';

describe('riskRules', () => {
  describe('validateAccountRisk', () => {
    it('should pass when risk is within threshold', () => {
      expect(() => {
        validateAccountRisk(100000, 500, 1.0);
      }).not.toThrow();
    });

    it('should throw when risk exceeds threshold', () => {
      expect(() => {
        validateAccountRisk(100000, 1500, 1.0);
      }).toThrow(RiskRuleViolationError);
    });

    it('should calculate risk percentage correctly', () => {
      expect(() => {
        validateAccountRisk(50000, 500, 1.0); // 1% exactly
      }).not.toThrow();

      expect(() => {
        validateAccountRisk(50000, 501, 1.0); // 1.002%
      }).toThrow(RiskRuleViolationError);
    });
  });

  describe('validateTimeWindow', () => {
    it('should pass during morning window', () => {
      expect(() => {
        validateTimeWindow('10:30');
      }).not.toThrow();
    });

    it('should pass during afternoon window', () => {
      expect(() => {
        validateTimeWindow('13:30');
      }).not.toThrow();
    });

    it('should throw outside trading windows', () => {
      expect(() => {
        validateTimeWindow('09:00');
      }).toThrow(TimeWindowViolationError);

      expect(() => {
        validateTimeWindow('15:00');
      }).toThrow(TimeWindowViolationError);
    });

    it('should respect window boundaries', () => {
      expect(() => {
        validateTimeWindow('10:15'); // Start of window
      }).not.toThrow();

      expect(() => {
        validateTimeWindow('10:45'); // End of window
      }).not.toThrow();

      expect(() => {
        validateTimeWindow('10:14'); // Just before
      }).toThrow(TimeWindowViolationError);

      expect(() => {
        validateTimeWindow('10:46'); // Just after
      }).toThrow(TimeWindowViolationError);
    });
  });

  describe('validateChaseAttempts', () => {
    it('should pass when attempts are below max', () => {
      expect(() => {
        validateChaseAttempts(0, 2);
      }).not.toThrow();

      expect(() => {
        validateChaseAttempts(1, 2);
      }).not.toThrow();
    });

    it('should throw when attempts reach max', () => {
      expect(() => {
        validateChaseAttempts(2, 2);
      }).toThrow(RiskRuleViolationError);
    });
  });

  describe('validateCreditFloor', () => {
    it('should pass when credit is above floor for SPX', () => {
      expect(() => {
        validateCreditFloor(2.5, 'SPX', 2.5); // Exact alert credit
      }).not.toThrow();

      expect(() => {
        validateCreditFloor(2.36, 'SPX', 2.5); // 0.14 slippage (< 0.15 max)
      }).not.toThrow();
    });

    it('should throw when credit is below floor for SPX', () => {
      expect(() => {
        validateCreditFloor(2.34, 'SPX', 2.5); // 0.16 slippage (> 0.15 max)
      }).toThrow(RiskRuleViolationError);
    });

    it('should pass when credit is above floor for QQQ', () => {
      expect(() => {
        validateCreditFloor(0.50, 'QQQ', 0.50); // Exact
      }).not.toThrow();

      expect(() => {
        validateCreditFloor(0.48, 'QQQ', 0.50); // 0.02 slippage (< 0.03 max)
      }).not.toThrow();
    });

    it('should throw when credit is below floor for QQQ', () => {
      expect(() => {
        validateCreditFloor(0.46, 'QQQ', 0.50); // 0.04 slippage (> 0.03 max)
      }).toThrow(RiskRuleViolationError);
    });
  });

  describe('shouldExitByTime', () => {
    it('should return false before noon', () => {
      expect(shouldExitByTime('2025-11-02T09:30:00Z', '11:59', '12:00')).toBe(false);
    });

    it('should return true at noon', () => {
      expect(shouldExitByTime('2025-11-02T09:30:00Z', '12:00', '12:00')).toBe(true);
    });

    it('should return true after noon', () => {
      expect(shouldExitByTime('2025-11-02T09:30:00Z', '13:00', '12:00')).toBe(true);
    });
  });

  describe('shouldExitByDelta', () => {
    it('should return false when delta below threshold', () => {
      expect(shouldExitByDelta(0.50, MAX_SHORT_DELTA)).toBe(false);
      expect(shouldExitByDelta(0.64, MAX_SHORT_DELTA)).toBe(false);
    });

    it('should return true when delta at or above threshold', () => {
      expect(shouldExitByDelta(0.65, MAX_SHORT_DELTA)).toBe(true);
      expect(shouldExitByDelta(0.70, MAX_SHORT_DELTA)).toBe(true);
    });

    it('should handle negative deltas (puts)', () => {
      expect(shouldExitByDelta(-0.64, MAX_SHORT_DELTA)).toBe(false);
      expect(shouldExitByDelta(-0.65, MAX_SHORT_DELTA)).toBe(true);
      expect(shouldExitByDelta(-0.70, MAX_SHORT_DELTA)).toBe(true);
    });
  });

  describe('calculateMaxContracts', () => {
    it('should calculate correct max contracts', () => {
      // $100k account, 1% risk = $1000 max risk
      // Max loss per contract = $470
      // Max contracts = floor(1000 / 470) = 2
      expect(calculateMaxContracts(100000, 470, 1.0)).toBe(2);
    });

    it('should return 0 when max loss exceeds account risk', () => {
      expect(calculateMaxContracts(100000, 1500, 1.0)).toBe(0);
    });

    it('should handle fractional results by flooring', () => {
      // $100k account, 1% risk = $1000 max risk
      // Max loss per contract = $333
      // Max contracts = floor(1000 / 333) = 3
      expect(calculateMaxContracts(100000, 333, 1.0)).toBe(3);
    });
  });
});

