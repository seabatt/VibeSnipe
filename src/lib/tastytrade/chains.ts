/**
 * Tastytrade option chain fetching and utility functions.
 * 
 * This module provides functionality to:
 * - Fetch option chains for a given symbol and expiration
 * - Select option contracts by delta
 * - Build vertical spread legs
 */

import { getClient } from './client';
import type {
  OptionInstrument,
  OptionChain,
  VerticalSpec,
  VerticalLegs,
} from './types';
import { logger } from '../logger';
import { ChainFetchError, StrikeNotFoundError } from '../errors';

/**
 * Fetches the option chain for a given symbol and expiration date.
 * 
 * Returns a minimal array of option contracts with strike, right (call/put),
 * delta, and streamerSymbol. The SDK handles the API call to Tastytrade's
 * option chain endpoint.
 * 
 * @param {string} symbol - Underlying symbol (e.g., "SPX", "QQQ")
 * @param {string} expiration - Expiration date in ISO format (e.g., "2025-10-31")
 * @returns {Promise<OptionInstrument[]>} Array of option contracts
 * @throws {Error} If symbol or expiration is invalid, or API call fails
 * 
 * @example
 * ```ts
 * const chain = await fetchOptionChain('SPX', '2025-10-31');
 * console.log(`Found ${chain.length} contracts`);
 * ```
 */
export async function fetchOptionChain(
  symbol: string,
  expiration: string
): Promise<OptionInstrument[]> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol must be a non-empty string');
  }

  if (!expiration || typeof expiration !== 'string') {
    throw new Error('Expiration must be a valid ISO date string');
  }

  // Validate expiration format (basic ISO date check)
  const expirationDate = new Date(expiration);
  if (isNaN(expirationDate.getTime())) {
    throw new Error('Expiration must be a valid ISO date string (YYYY-MM-DD)');
  }

  try {
    const client = await getClient();
    
    // Fetch option chain from SDK using instruments service
    // SDK has getOptionChain method that takes symbol
    // The response contains options for all expirations, we'll filter by requested expiration
    const response = await client.instrumentsService.getOptionChain(symbol);
    
    // Normalize SDK response to OptionInstrument[] format
    // SDK returns options with various structures - filter by expiration
    const contracts: OptionInstrument[] = [];
    
    // SDK response format may vary - handle both array and data wrapper
    const options = Array.isArray(response) 
      ? response 
      : (response?.data || (Array.isArray(response?.items) ? response.items : []));
    
    if (options && Array.isArray(options)) {
      for (const contract of options) {
        // Parse expiration date - filter by the requested expiration
        const contractExpiration = contract.expiration_date || 
                                   contract.expiration || 
                                   contract.exp ||
                                   contract['expiration-date'];
        
        // Skip if expiration doesn't match
        if (contractExpiration && contractExpiration !== expiration) {
          continue;
        }
        
        // Parse option type (C for CALL, P for PUT)
        const optionType = contract.option_type || 
                          contract.optionType || 
                          contract['option-type'] ||
                          contract.type ||
                          '';
        const right: 'CALL' | 'PUT' = optionType === 'C' || 
                                     optionType === 'CALL' || 
                                     optionType.toUpperCase() === 'CALL'
          ? 'CALL' 
          : 'PUT';
        
        // Extract strike price
        const strike = typeof contract.strike_price === 'string' 
          ? parseFloat(contract.strike_price) 
          : (contract.strike_price || contract.strikePrice || contract.strike || 0);
        
        // Extract streamer symbol (DXLink format)
        const streamerSymbol = contract.streamer_symbol || 
          contract.streamerSymbol || 
          contract.symbol ||
          `${symbol}_${expiration}_${strike}${right.charAt(0)}`;
        
        contracts.push({
          symbol: contract.underlying_symbol || contract.underlyingSymbol || contract.underlying || symbol,
          strike,
          right,
          expiration: contractExpiration || expiration,
          streamerSymbol,
          delta: contract.delta !== undefined ? parseFloat(contract.delta) : undefined,
          gamma: contract.gamma !== undefined ? parseFloat(contract.gamma) : undefined,
          theta: contract.theta !== undefined ? parseFloat(contract.theta) : undefined,
          vega: contract.vega !== undefined ? parseFloat(contract.vega) : undefined,
          bid: contract.bid !== undefined ? parseFloat(contract.bid) : undefined,
          ask: contract.ask !== undefined ? parseFloat(contract.ask) : undefined,
          mark: contract.mark !== undefined 
            ? parseFloat(contract.mark) 
            : (contract.bid !== undefined && contract.ask !== undefined
              ? (parseFloat(contract.bid) + parseFloat(contract.ask)) / 2
              : undefined),
        });
      }
    }

    logger.info('Option chain fetched', { symbol, expiration, count: contracts.length });
    return contracts;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch option chain', { symbol, expiration }, error as Error);
    throw new ChainFetchError(
      `Failed to fetch option chain for ${symbol} exp ${expiration}: ${errorMessage}`,
      symbol,
      expiration
    );
  }
}

/**
 * Picks the option contract from a chain that is nearest to the target delta.
 * 
 * Searches through the provided chain (filtered by right) and finds the
 * contract with the delta closest to the target delta value.
 * 
 * @param {OptionInstrument[]} chain - Array of option contracts
 * @param {number} targetDelta - Target delta value (e.g., 0.30 for 30 delta)
 * @param {'CALL' | 'PUT'} right - Option type: 'CALL' or 'PUT'
 * @returns {OptionInstrument | null} The contract nearest to target delta, or null if not found
 * 
 * @example
 * ```ts
 * const shortLeg = pickShortByDelta(chain, 0.30, 'PUT');
 * if (shortLeg) {
 *   console.log(`Selected strike: ${shortLeg.strike}, delta: ${shortLeg.delta}`);
 * }
 * ```
 */
export function pickShortByDelta(
  chain: OptionInstrument[],
  targetDelta: number,
  right: 'CALL' | 'PUT'
): OptionInstrument | null {
  if (!Array.isArray(chain) || chain.length === 0) {
    return null;
  }

  if (typeof targetDelta !== 'number' || isNaN(targetDelta)) {
    throw new Error('Target delta must be a valid number');
  }

  if (right !== 'CALL' && right !== 'PUT') {
    throw new Error('Right must be either "CALL" or "PUT"');
  }

  // Filter chain by right (call/put)
  const filteredChain = chain.filter(contract => contract.right === right);

  if (filteredChain.length === 0) {
    return null;
  }

  // Find contract with delta closest to target
  // For calls, we want positive deltas near target
  // For puts, we want negative deltas, so we use absolute value
  let closest: OptionInstrument | null = null;
  let minDeltaDiff = Infinity;

  for (const contract of filteredChain) {
    if (contract.delta === undefined || contract.delta === null) {
      continue; // Skip contracts without delta
    }

    // Calculate absolute difference from target delta
    // For puts, we typically work with absolute delta values
    const contractDeltaAbs = Math.abs(contract.delta);
    const targetDeltaAbs = Math.abs(targetDelta);
    const deltaDiff = Math.abs(contractDeltaAbs - targetDeltaAbs);

    if (deltaDiff < minDeltaDiff) {
      minDeltaDiff = deltaDiff;
      closest = contract;
    }
  }

  return closest;
}

/**
 * Builds a vertical spread by combining a short leg with a long leg.
 * 
 * The long leg is selected by moving the specified width in the same direction
 * as the short leg. For calls, width is added to strike; for puts, width is
 * subtracted from strike.
 * 
 * @param {OptionInstrument} shortLeg - The short leg option contract
 * @param {number} width - Width between strikes (e.g., 5, 10, 20)
 * @returns {VerticalLegs | null} Object containing short and long legs, or null if long leg not found
 * @throws {Error} If shortLeg is invalid or width is not positive
 * 
 * @example
 * ```ts
 * const vertical = buildVertical(shortLeg, 10);
 * if (vertical) {
 *   console.log(`Short: ${vertical.shortLeg.strike}, Long: ${vertical.longLeg.strike}`);
 * }
 * ```
 */
export function buildVertical(
  shortLeg: OptionInstrument,
  width: number
): VerticalLegs | null {
  if (!shortLeg || typeof shortLeg !== 'object') {
    throw new Error('Short leg must be a valid OptionInstrument');
  }

  if (typeof width !== 'number' || width <= 0 || isNaN(width)) {
    throw new Error('Width must be a positive number');
  }

  // Calculate target strike for long leg
  const targetStrike = shortLeg.right === 'CALL'
    ? shortLeg.strike + width  // For calls, long leg is higher strike
    : shortLeg.strike - width; // For puts, long leg is lower strike

  // Build long leg from short leg data
  // Note: This creates a long leg structure but won't have real quote data
  // For full implementation, the chain should be passed or fetched to get the actual contract
  // For now, building from available data
  const longLeg: OptionInstrument = {
    symbol: shortLeg.symbol,
    strike: targetStrike,
    right: shortLeg.right,
    expiration: shortLeg.expiration,
    streamerSymbol: shortLeg.streamerSymbol.replace(
      `${shortLeg.strike}`,
      `${targetStrike}`
    ) || `${shortLeg.symbol}_${shortLeg.expiration}_${targetStrike}${shortLeg.right.charAt(0)}`,
  };

  return {
    shortLeg,
    longLeg,
  };
}

/**
 * Builds a vertical spread from a chain, selecting both legs by delta.
 * 
 * This is a convenience function that combines pickShortByDelta and buildVertical,
 * finding both legs from a chain based on delta and width.
 * 
 * @param {OptionInstrument[]} chain - Option chain
 * @param {number} shortDelta - Target delta for short leg
 * @param {number} width - Width between strikes
 * @param {'CALL' | 'PUT'} right - Option type
 * @returns {VerticalLegs | null} Vertical spread legs or null if not found
 * 
 * @example
 * ```ts
 * const vertical = await buildVerticalFromChain(chain, 0.30, 10, 'PUT');
 * ```
 */
export async function buildVerticalFromChain(
  chain: OptionInstrument[],
  shortDelta: number,
  width: number,
  right: 'CALL' | 'PUT'
): Promise<VerticalLegs | null> {
  // Find short leg by delta
  const shortLeg = pickShortByDelta(chain, shortDelta, right);
  
  if (!shortLeg) {
    return null;
  }

  // Calculate target strike for long leg
  const targetStrike = right === 'CALL'
    ? shortLeg.strike + width
    : shortLeg.strike - width;

  // Find long leg with matching strike, right, and expiration
  const longLeg = chain.find(
    contract =>
      contract.right === right &&
      contract.strike === targetStrike &&
      contract.expiration === shortLeg.expiration
  );

  if (!longLeg) {
    return null;
  }

  return {
    shortLeg,
    longLeg,
  };
}

/**
 * Fetches option chain and builds a vertical spread based on specification.
 * 
 * Convenience function that combines chain fetching, delta picking, and
 * vertical building into a single operation.
 * 
 * @param {VerticalSpec} spec - Vertical spread specification
 * @returns {Promise<VerticalLegs | null>} Vertical spread legs or null if not found
 * 
 * @example
 * ```ts
 * const spec: VerticalSpec = {
 *   underlying: 'SPX',
 *   expiration: '2025-10-31',
 *   targetDelta: 0.30,
 *   right: 'PUT',
 *   width: 10,
 *   quantity: 1,
 * };
 * const vertical = await fetchAndBuildVertical(spec);
 * ```
 */
export async function fetchAndBuildVertical(
  spec: VerticalSpec
): Promise<VerticalLegs | null> {
  // Fetch the option chain
  const chain = await fetchOptionChain(spec.underlying, spec.expiration);

  // Build the vertical from the chain
  return buildVerticalFromChain(
    chain,
    spec.targetDelta,
    spec.width,
    spec.right
  );
}

