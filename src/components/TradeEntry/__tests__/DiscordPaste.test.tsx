import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscordPaste } from '../DiscordPaste';
import { useOrders } from '@/stores/useOrders';

// Mock the Zustand stores
jest.mock('@/stores/useOrders');

describe('DiscordPaste - TastyTrade Alert Parser', () => {
  const mockSetPendingOrder = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    (useOrders as jest.Mock).mockReturnValue({
      setPendingOrder: mockSetPendingOrder,
    });
  });

  describe('Expiry Date Parsing', () => {
    it('should parse 2-digit year expiry date (31 Oct 25)', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical SPX 100 31 Oct 25 6855/6860 CALL @0.3 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      // Wait for parsing to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      expect(callArgs.legs[0].expiry).toBe('2025-10-31');
    });

    it('should parse 4-digit year expiry date (15 DEC 2024)', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical QQQ 15 DEC 2024 5900/5910 PUT @2.50 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      expect(callArgs.legs[0].expiry).toBe('2024-12-15');
    });

    it('should parse case-insensitive month names', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical SPX 23 jan 25 6855/6860 CALL @0.3 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      expect(callArgs.legs[0].expiry).toBe('2025-01-23');
    });

    it('should default to today for 0DTE alerts without expiry date', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical SPX 6855/6860 CALL @0.3 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      // Should use today's date
      const today = new Date().toISOString().split('T')[0];
      expect(callArgs.legs[0].expiry).toBe(today);
    });
  });

  describe('Standard TastyTrade Format Parsing', () => {
    it('should parse complete SPX vertical alert', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical SPX 100 31 Oct 25 6855/6860 CALL @0.3 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      
      expect(callArgs.legs).toHaveLength(2);
      expect(callArgs.legs[0].action).toBe('BUY');
      expect(callArgs.legs[0].right).toBe('CALL');
      expect(callArgs.legs[0].strike).toBe(6855);
      expect(callArgs.legs[1].action).toBe('SELL');
      expect(callArgs.legs[1].right).toBe('CALL');
      expect(callArgs.legs[1].strike).toBe(6860);
      expect(callArgs.legs[0].expiry).toBe('2025-10-31');
    });

    it('should parse QQQ butterfly alert', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'BUY -1 Butterfly QQQ 15 Jan 25 515/520/525 PUT @1.45 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      
      expect(callArgs.legs).toHaveLength(3);
      expect(callArgs.legs[0].strike).toBe(515);
      expect(callArgs.legs[1].strike).toBe(520);
      expect(callArgs.legs[1].quantity).toBe(2);
      expect(callArgs.legs[2].strike).toBe(525);
    });
  });

  describe('Edge Cases', () => {
    it('should handle single-digit day', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical SPX 3 Oct 25 6855/6860 CALL @0.3 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      expect(callArgs.legs[0].expiry).toBe('2025-10-03');
    });

    it('should handle February 29 in leap year', async () => {
      const user = userEvent.setup();
      render(<DiscordPaste />);
      
      const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
      const alertText = 'SELL -1 Vertical SPX 29 Feb 24 6855/6860 CALL @0.3 LMT';
      
      await user.type(textarea, alertText);
      await user.paste(alertText);
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(mockSetPendingOrder).toHaveBeenCalled();
      const callArgs = mockSetPendingOrder.mock.calls[0][0];
      expect(callArgs.legs[0].expiry).toBe('2024-02-29');
    });
  });
});

