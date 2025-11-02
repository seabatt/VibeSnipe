/**
 * Test script for vertical spread submission.
 * 
 * This script tests the full vertical spread flow:
 * 1. Login via getClient()
 * 2. Fetch today's SPX option chain
 * 3. Build a short put vertical (10 wide, -0.20 delta)
 * 4. Dry-run the order and print expected credit
 * 5. Submit live order to sandbox and log order ID
 * 
 * Run with: npx tsx src/scripts/testVertical.ts
 */

import {
  getClient,
  fetchOptionChain,
  pickShortByDelta,
  buildVertical,
  dryRunVertical,
  submitVertical,
} from '../lib/tastytrade';

/**
 * Gets today's date in ISO format (YYYY-MM-DD).
 * 
 * @returns {string} Today's date in ISO format
 */
function getTodayISO(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Gets account ID from client.
 * This is a placeholder - actual implementation depends on SDK API.
 * 
 * @returns {Promise<string>} Account ID
 */
async function getAccountId(): Promise<string> {
  try {
    const client = await getClient();
    
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example:
    // const accounts = await client.accounts.list();
    // return accounts.data[0].accountNumber;

    // For now, return a placeholder or get from environment
    const accountId = process.env.TASTYTRADE_ACCOUNT_ID || 'DEMO-ACCOUNT';
    
    console.warn('⚠️  Using placeholder account ID. Update this with actual SDK account retrieval.');
    
    return accountId;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get account ID: ${errorMessage}`);
  }
}

/**
 * Main test function.
 */
async function main() {
  try {
    console.log('🚀 Starting vertical spread test...\n');

    // Step 1: Login via getClient()
    console.log('📡 Step 1: Connecting to Tastytrade API...');
    const client = await getClient();
    const env = process.env.TASTYTRADE_ENV || 'sandbox';
    console.log(`✅ Connected to ${env} environment\n`);

    // Step 2: Get account ID
    console.log('👤 Step 2: Getting account information...');
    const accountId = await getAccountId();
    console.log(`✅ Account ID: ${accountId}\n`);

    // Step 3: Fetch today's SPX option chain
    const symbol = 'SPX';
    const expiration = getTodayISO();
    
    console.log(`📊 Step 3: Fetching ${symbol} option chain for ${expiration}...`);
    const chain = await fetchOptionChain(symbol, expiration);
    console.log(`✅ Fetched ${chain.length} option contracts\n`);

    if (chain.length === 0) {
      throw new Error('No option contracts found. Check if market is open and expiration is valid.');
    }

    // Step 4: Build short put vertical at -0.20 delta, 10 wide
    console.log('🔧 Step 4: Building short put vertical...');
    console.log('   Strategy: Short Put Vertical');
    console.log('   Target Delta: -0.20');
    console.log('   Width: 10');
    console.log('   Right: PUT\n');

    const targetDelta = -0.20;
    const width = 10;
    const right = 'PUT' as const;

    // Pick short leg by delta
    const shortLeg = pickShortByDelta(chain, Math.abs(targetDelta), right);

    if (!shortLeg) {
      throw new Error(
        `No PUT contract found near target delta ${targetDelta}. ` +
        `Available contracts: ${chain.filter((c) => c.right === right).length}`
      );
    }

    console.log(`   ✅ Selected short leg:`);
    console.log(`      Strike: ${shortLeg.strike}`);
    console.log(`      Delta: ${shortLeg.delta?.toFixed(4) || 'N/A'}`);
    console.log(`      Streamer Symbol: ${shortLeg.streamerSymbol}\n`);

    // Build vertical (long leg is 10 strikes lower for puts)
    const vertical = buildVertical(shortLeg, width);

    if (!vertical) {
      throw new Error('Failed to build vertical spread. Could not find matching long leg.');
    }

    console.log(`   ✅ Built vertical spread:`);
    console.log(`      Short Leg: ${vertical.shortLeg.strike} PUT`);
    console.log(`      Long Leg: ${vertical.longLeg.strike} PUT`);
    console.log(`      Width: ${width}\n`);

    // Step 5: Dry-run the order
    console.log('🧪 Step 5: Dry-running order...');
    const quantity = 1;
    const limitPrice = vertical.shortLeg.ask && vertical.longLeg.bid
      ? vertical.shortLeg.ask - vertical.longLeg.bid
      : undefined;

    if (!limitPrice || limitPrice <= 0) {
      throw new Error(
        'Cannot determine limit price. Short leg ask or long leg bid not available.\n' +
        `   Short leg ask: ${vertical.shortLeg.ask || 'N/A'}\n` +
        `   Long leg bid: ${vertical.longLeg.bid || 'N/A'}`
      );
    }

    const dryRunResult = await dryRunVertical(vertical, quantity, limitPrice, 'LIMIT');

    if (!dryRunResult.valid) {
      console.error('❌ Dry-run failed:');
      dryRunResult.errors?.forEach((error: string) => console.error(`   ${error}`));
      throw new Error('Dry-run validation failed');
    }

    console.log(`✅ Dry-run passed`);
    console.log(`   Estimated Credit: $${dryRunResult.estimatedPrice?.toFixed(2) || 'N/A'}`);
    if (dryRunResult.warnings && dryRunResult.warnings.length > 0) {
      console.log(`   Warnings: ${dryRunResult.warnings.join(', ')}`);
    }
    console.log('');

    // Step 6: Submit live order to sandbox
    console.log('📤 Step 6: Submitting live order to sandbox...');
    console.log(`   Quantity: ${quantity}`);
    console.log(`   Limit Price: $${limitPrice.toFixed(2)}`);
    console.log(`   Order Type: LIMIT\n`);

    const order = await submitVertical(
      vertical,
      quantity,
      limitPrice,
      'LIMIT',
      accountId
    );

    console.log('✅ Order submitted successfully!');
    console.log(`   Order ID: ${order.id}`);
    console.log(`   Status: ${order.status}`);
    console.log(`   Account ID: ${order.accountId}`);
    console.log(`   Quantity: ${order.quantity}`);
    console.log(`   Net Price: $${order.netPrice?.toFixed(2) || 'N/A'}`);
    console.log(`   Created At: ${order.createdAt}`);
    console.log('');

    console.log('🎉 Test completed successfully!');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('\n❌ Test failed:');
    console.error(`   ${errorMessage}`);
    
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:');
      console.error(error.stack);
    }
    
    process.exit(1);
  }
}

// Run the test
main();

