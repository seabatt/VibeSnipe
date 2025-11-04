# Working Order State - Real-World Trading Flow

## What Happens When Your Order Doesn't Fill Immediately

In V3, after you press **Execute**, the order goes through a realistic flow:

```
Preview → Executing (1.5s) → Working → Filled
                                ↓
                            (Cancel/Modify)
```

---

## **Step 1: Executing** (1.5 seconds)

**What you see:**
- Pulsing Send icon (blue)
- "Sending Order..."
- "Routing to broker"

**What's happening:**
- Order is being validated
- Routing to broker/exchange
- TP/SL orders are being attached

**Cannot cancel** - order is in flight

---

## **Step 2: Working** (Until Filled or Cancelled)

**What you see:**

### **Status Header**
- 🔄 Spinning Activity icon (amber)
- "Order Working"
- "Waiting for fill at $2.45 · 12s in market"

### **Order Card**
Shows live comparison:

| Working Price | Current Market |
|---------------|----------------|
| $2.45 | Bid 2.43 × Ask 2.47 |
| (Your limit) | Mid: $2.45 |

### **Fill Likelihood Bar**
- Amber progress bar (fills over time)
- Context messages:
  - ✓ "Below bid - should fill soon"
  - ○ "Near market - waiting for movement"
  - ⚠️ "Above market - unlikely to fill quickly"

### **Action Buttons**

1. **Cancel Order** (gray)
   - Immediately cancels working order
   - Returns to Choose screen
   - No position opened

2. **Modify Price** (gray)
   - Shows inline price adjuster
   - **Lower -$0.05** (more aggressive, faster fill)
   - **Raise +$0.05** (less aggressive, slower fill)
   - Modifies limit price while order still working
   - Resets fill likelihood

3. **Simulate Fill** (green) ⭐
   - For demo/testing only
   - In production, this would be automatic
   - Moves to Filled state

### **Info Footer**
- 💡 "TP/SL will attach automatically on fill"
- Reminds you discipline is built-in

---

## **Real-World Scenarios**

### **Scenario 1: Instant Fill** (Market Is Fast)
```
You: Click Execute at $2.45 (mid is $2.45)
→ Executing (1.5s)
→ Working (2s) - market moves, you get filled
→ Filled ✓
```

**Why it filled:** Your limit was at market mid, someone hit your price

---

### **Scenario 2: Waiting for Movement** (Patient Fill)
```
You: Click Execute at $2.40 (mid is $2.45)
→ Executing (1.5s)
→ Working (15s) - bar at 50%, message: "Below market - should fill soon"
→ Market moves down, mid drops to $2.42
→ Working (20s) - bar at 67%
→ Filled ✓
```

**Why it filled:** Market came to you (waited 20 seconds total)

---

### **Scenario 3: Too Aggressive, Need to Modify** (Price Adjustment)
```
You: Click Execute at $2.30 (mid is $2.45)
→ Executing (1.5s)
→ Working (5s) - bar at 17%, message: "⚠️ Above market - unlikely to fill quickly"
You: Click "Modify Price" → "Lower -$0.05" → now $2.25
→ Working resets (0s) - bar at 25%, message: "○ Near market - waiting for movement"
→ Working (8s) - bar at 27%
You: Click "Modify Price" → "Lower -$0.05" → now $2.20
→ Filled ✓ (market was at 2.43×2.47, you got filled at 2.20 debit)
```

**Why it filled:** You chased the market down until filled

---

### **Scenario 4: Market Moved Away, Cancel** (Cut Losses)
```
You: Click Execute at $2.40 (mid is $2.45)
→ Executing (1.5s)
→ Working (10s) - bar at 33%
→ Market moves UP, mid is now $2.60
→ Working (15s) - bar at 50%, message: "⚠️ Above market - unlikely to fill quickly"
You: Click "Cancel Order"
→ Back to Choose screen (no position opened)
```

**Why you cancelled:** Market moved against you, would need to chase +$0.20

---

## **Fill Likelihood Algorithm**

The amber progress bar estimates fill probability based on:

1. **Time in market** (increases over time)
   - 0s = 0%
   - 30s = 85% max
   - Formula: `Math.min(timeWorking / 30, 0.85)`

2. **Price vs Market** (context message)
   - `limitPrice > marketData.mid` → ⚠️ Above market (red flag)
   - `limitPrice < marketData.bid` → ✓ Below bid (likely fill)
   - `else` → ○ Near market (neutral)

**Note:** In production, this would use real broker queue data + Greeks

---

## **When to Cancel vs Modify vs Wait**

### **Cancel When:**
- Market moved significantly against you (+$0.15+)
- Window is closing (e.g., 12:55 and you wanted entry by 12:30)
- Setup is invalidated (e.g., SPX broke support)
- You see a better opportunity

### **Modify When:**
- You're close but market is drifting (+$0.05 away)
- Time is ticking but setup still valid
- You want to "chase" by 1-2 ticks
- Fill likelihood bar is stuck below 30%

### **Wait When:**
- Your price is near market (within 1 tick)
- Fill likelihood bar is climbing
- Market is choppy (likely to come to you)
- You have time (e.g., 10:05 in 10:00-10:30 block)

---

## **Keyboard Shortcuts (Future)**

Not yet implemented, but planned:

- `⌘K` → Cancel order
- `⌘M` → Show modify menu
- `⌘↓` → Lower price by tick
- `⌘↑` → Raise price by tick
- `⌘F` → Simulate fill (dev mode only)

---

## **Production Differences**

### **In Demo (Current):**
- Fill likelihood is simulated (time-based)
- "Simulate Fill" button (manual)
- Market data is random walk

### **In Production:**
- Fill likelihood uses:
  - Broker queue position
  - Volume at your price level
  - Spread width & liquidity
  - Historical fill rates
- Fills happen automatically (no button)
- Market data is real-time WebSocket
- Partial fills shown (e.g., "2 of 4 contracts filled")

---

## **Mobile Experience**

Working state is already mobile-optimized:

- **Vertical stack** (no grid)
- **Large touch targets** (48px buttons)
- **No hover states** (click to modify, not hover)
- **Full-width cards** (no side-by-side)

---

## **Ambient Design Principles**

### **Calm, Not Stressful**
- ✅ Spinning icon (smooth, not jarring)
- ✅ Amber color (warning, not panic)
- ✅ Progress bar (fills slowly, gives context)
- ✅ Clear actions (3 buttons, obvious)

### **Context, Not Noise**
- ✅ Timer in header ("12s in market")
- ✅ Market data updates live (bid/ask/mid)
- ✅ One clear message (above/below/near)
- ❌ No flashing alerts
- ❌ No sound effects
- ❌ No countdown timers

### **Action, Not Paralysis**
- ✅ 3 clear options (Cancel / Modify / Fill)
- ✅ Modify is inline (no modal)
- ✅ One-click price adjustment (+/- $0.05)
- ❌ No 10-field form
- ❌ No confirmation dialogs

---

## **Comparison: V2 vs V3 Working State**

| Feature | V2 Complete System | V3 Cinematic Flow |
|---------|-------------------|-------------------|
| **Order State Banner** | ✅ Draft/Working/Filled chips | ✅ Full-screen Working step |
| **Time in Market** | ❌ Not shown | ✅ "12s in market" |
| **Fill Likelihood** | ❌ Not shown | ✅ Progress bar + message |
| **Cancel Order** | ✅ Small button | ✅ Large button (1/3 width) |
| **Modify Price** | ❌ Must cancel + re-enter | ✅ Inline modifier |
| **Market Data** | ✅ Spread panel (always visible) | ✅ Order card (contextual) |
| **Visual Style** | Static banner | **Cinematic transition** |

**V3 is 10x clearer** when order is working.

---

## **Why This Matters**

In fast scalping (1-3 trades per block), knowing your order status is **sacred**:

1. **Time is scarce** - 10:00-10:30 window = 30 minutes
2. **Entry matters** - Filled at $2.40 vs $2.60 = 40% difference in risk
3. **Opportunity cost** - Waiting 2 minutes for fill = missed setup

**V3's Working state** gives you:
- ✅ **Clarity** - Exactly where your order is
- ✅ **Control** - Cancel/modify without re-entering
- ✅ **Calm** - No panic, just information

This is **execution as art**.

---

## **Next Steps**

### **Immediate (Demo):**
1. ✅ Working state implemented
2. ✅ Cancel/Modify/Fill actions
3. ✅ Fill likelihood bar
4. ⚠️ Wire keyboard shortcuts (⌘K, ⌘M, etc.)

### **Production (Real Trading):**
1. ⚠️ Wire to broker API (Tastytrade, Interactive Brokers, etc.)
2. ⚠️ Real-time order status updates (WebSocket)
3. ⚠️ Partial fill tracking ("2/4 contracts filled")
4. ⚠️ Advanced fill probability (queue position, volume)
5. ⚠️ Auto-transition to Filled (no manual button)
6. ⚠️ Order rejections (insufficient buying power, etc.)

---

## **Try It Now**

1. Go to **"Cinematic Flow"** tab
2. Choose **Saved Preset** → SPX 50Δ 10-Wide → CALL
3. Click **Execute Trade**
4. Wait 1.5s (Executing)
5. See **Working state** appear
6. Watch timer count up (5s, 10s, 15s...)
7. Watch fill likelihood bar grow
8. Try **Modify Price** (click ±$0.05)
9. Click **Simulate Fill** → Celebration ✓

The flow is: Choose → Preset → Preview → Execute → **Working** → Filled

**Working is the missing piece** - realistic, calm, actionable.
