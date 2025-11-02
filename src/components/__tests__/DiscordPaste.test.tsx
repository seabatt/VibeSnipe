import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DiscordPaste } from '../TradeEntry/DiscordPaste';

// Mock the useOrders store
jest.mock('@/stores/useOrders', () => ({
  useOrders: () => ({
    setPendingOrder: jest.fn(),
  }),
}));

// Mock the useTokens hook
jest.mock('@/hooks/useTokens', () => ({
  useTokens: () => ({
    colors: {
      bg: '#000',
      surface: '#111',
      border: '#333',
      textPrimary: '#fff',
      textSecondary: '#aaa',
      subtle: '#666',
      semantic: {
        profit: '#0f0',
        risk: '#f00',
        info: '#00f',
        warning: '#ff0',
      },
    },
    space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
    type: { sizes: { xs: 11, sm: 13, base: 15, lg: 17 } },
    radius: { sm: 8, md: 12 },
  }),
}));

describe('DiscordPaste', () => {
  it('should render textarea', () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    expect(textarea).toBeInTheDocument();
  });

  it('should parse valid SPX vertical alert', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const validAlert = 'SELL -1 Vertical SPX 100 31 Oct 25 5900/5910 CALL @2.45 LMT';
    await userEvent.type(textarea, validAlert);
    
    // Wait for parsing
    await waitFor(() => {
      expect(screen.getByText(/Parsed Successfully/i)).toBeInTheDocument();
    });
    
    // Check parsed values are displayed
    expect(screen.getByText(/SPX Vertical CALL/i)).toBeInTheDocument();
    expect(screen.getByText(/5900\/5910/)).toBeInTheDocument();
  });

  it('should parse QQQ vertical alert', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const validAlert = 'SELL -1 Vertical QQQ 450/452 PUT @0.50 LMT';
    await userEvent.type(textarea, validAlert);
    
    await waitFor(() => {
      expect(screen.getByText(/QQQ Vertical PUT/i)).toBeInTheDocument();
    });
  });

  it('should handle invalid alert format', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const invalidAlert = 'This is not a valid alert';
    await userEvent.type(textarea, invalidAlert);
    
    await waitFor(() => {
      const errorText = screen.queryByText(/Parse error/i) || screen.queryByText(/Could not parse/i);
      expect(errorText).toBeInTheDocument();
    });
  });

  it('should extract strikes correctly', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const alert = 'SELL -1 Vertical SPX 6855/6860 CALL @0.30 LMT';
    await userEvent.type(textarea, alert);
    
    await waitFor(() => {
      expect(screen.getByText(/6855\/6860/)).toBeInTheDocument();
    });
  });

  it('should extract limit price correctly', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const alert = 'SELL -1 Vertical SPX 5900/5910 CALL @2.45 LMT';
    await userEvent.type(textarea, alert);
    
    await waitFor(() => {
      expect(screen.getByText(/\$2\.45/)).toBeInTheDocument();
    });
  });

  it('should support butterfly strategy', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const alert = 'SELL 1 Butterfly SPX 5900/5910/5920 CALL @1.50 LMT';
    await userEvent.type(textarea, alert);
    
    await waitFor(() => {
      expect(screen.getByText(/Butterfly/i)).toBeInTheDocument();
    });
  });

  it('should allow price nudging', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const alert = 'SELL -1 Vertical SPX 5900/5910 CALL @2.45 LMT';
    await userEvent.type(textarea, alert);
    
    await waitFor(() => {
      expect(screen.getByText(/\$2\.45/)).toBeInTheDocument();
    });
    
    // Find and click the plus button
    const plusButtons = screen.getAllByRole('button');
    const priceUpButton = plusButtons.find(btn => {
      const svg = btn.querySelector('svg');
      return svg && svg.getAttribute('class')?.includes('lucide');
    });
    
    if (priceUpButton) {
      fireEvent.click(priceUpButton);
      
      await waitFor(() => {
        // Price should increase by 0.05
        expect(screen.getByText(/\$2\.50/)).toBeInTheDocument();
      });
    }
  });

  it('should handle paste event', async () => {
    render(<DiscordPaste />);
    const textarea = screen.getByPlaceholderText(/SELL -1 Vertical/i);
    
    const alert = 'SELL -1 Vertical SPX 5900/5910 CALL @2.45 LMT';
    
    // Simulate paste
    fireEvent.paste(textarea, {
      clipboardData: {
        getData: () => alert,
      },
    });
    
    await waitFor(() => {
      expect(screen.getByText(/SPX Vertical CALL/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });
});

