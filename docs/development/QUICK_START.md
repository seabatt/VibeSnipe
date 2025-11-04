# VibeSnipe Quick Start

## Create a Trade: Two Paths

### **Path 1: Discord Alert (⌘V)**
**Use when:** You receive a signal from your Discord group

1. Click **"Discord Alert"** (or press `⌘V`)
2. Paste: `SELL -1 Vertical SPX 5900/5910 CALL @2.45 LMT`
3. **Preview** screen appears with hero risk graph
4. Adjust TP/SL if needed (defaults: 50%/100%)
5. Press **Execute** (or `⌘↵`)
6. Wait for fill → Done

**Flow:** Choose → Paste → Preview → Execute → Filled

---

### **Path 2: Saved Preset (⌘P)** ⭐
**Use when:** You want to execute your standard 50Δ 10-wide setup

1. Click **"Saved Preset"** (or press `⌘P`)
2. Select preset: **SPX 50Δ 10-Wide**
   - TP 50% (or close at 1pm)
   - SL 100%
   - Cut 13:00
3. Choose direction: **CALL** or **PUT**
4. Click **"Continue to Preview"**
5. **Preview** screen shows risk graph with your preset rules
6. Press **Execute** (or `⌘↵`)
7. Wait for fill → Done

**Flow:** Choose → Preset → Select → Direction → Preview → Execute → Filled

---

## Your Saved Presets

Currently available:

### **1. SPX 50Δ 10-Wide** (Your Default)
- **Strategy:** Vertical spread
- **Target:** 50 delta
- **Width:** 10 points
- **TP:** 50% of max gain
- **SL:** 100% of risk (full loss)
- **Time Exit:** Cut at 13:00 ET (1pm)
- **Use case:** Standard momentum scalp

### **2. SPY 40Δ 5-Wide**
- **Strategy:** Vertical spread
- **Target:** 40 delta (safer)
- **Width:** 5 points (tighter)
- **TP:** 50%
- **SL:** 100%
- **Time Exit:** Cut at 13:00 ET
- **Use case:** Lower risk, smaller capital

### **3. QQQ 50Δ 10-Wide**
- **Strategy:** Vertical spread
- **Target:** 50 delta
- **Width:** 10 points
- **TP:** 50%
- **SL:** 100%
- **Time Exit:** Cut at 13:00 ET
- **Use case:** Tech momentum play

---

## How Presets Work

When you select a preset:

1. **Auto-calculates strikes** based on:
   - Current underlying price (e.g., SPX @ 5905)
   - Target delta (50Δ = ~5 points OTM)
   - Width (10 points)
   - Direction (CALL → long 5910, short 5920)

2. **Sets limit price** to current mid:
   - Reads live market: Bid 2.43 · Mid 2.45 · Ask 2.47
   - Starts order at $2.45

3. **Attaches exits** (pre-send):
   - TP: Closes at 50% of max gain (e.g., +$250 on a $500 risk)
   - SL: Closes at 100% loss ($500 full stop)
   - Time: Closes at 13:00 ET no matter what

4. **You can still nudge:**
   - Click **±** buttons to adjust price by tick (0.05)
   - Modify TP/SL percentages if needed
   - Everything updates live on risk graph

---

## Keyboard Shortcuts

### **Flow Navigation**
- `⌘V` → Jump to Discord Paste
- `⌘P` → Jump to Saved Preset
- `⌘↵` → Execute trade (when on Preview)
- `⌘.` → Cancel (back to Choose)

### **In Preview**
- `↑` / `↓` → Nudge price by tick (future)
- `Tab` → Cycle through TP/SL inputs

---

## Understanding the Preview Screen

### **Hero Risk Graph** (Top - Full Width)
- **Green area** = Profit zone
- **Blue dashed line** = Current price (Now)
- **Amber dashed line** = Breakeven point
- **Hover** to see P/L at any price
- Updates every 200ms with live market data

### **Context Cards** (Below Graph)
1. **Strikes:** Shows your legs (5910/5920)
2. **Spread Price:** Live mid with nudge buttons
3. **Position Risk:** Max loss in $ and % of account

### **Discipline Panel** (Bottom)
- **TP Stepper:** Adjust take profit %
- **SL Stepper:** Adjust stop loss %
- Both attached **before** you send

### **Sacred CTA** (Very Bottom)
- **Full-width Execute button** with `⌘↵` hint
- Glowing blue (impossible to miss)
- Cancel is small and gray (secondary)

---

## Example: Execute SPX 50Δ 10-Wide CALL

```
1. Open VibeSnipe → "Cinematic Flow" tab

2. Click "Saved Preset" (or ⌘P)

3. Click "SPX 50Δ 10-Wide" card

4. Click "CALL" button (green)

5. Click "Continue to Preview"

6. See risk graph:
   - SPX @ 5905 (current)
   - Long 5910 / Short 5920 (auto-calculated)
   - Limit: $2.45 (current mid)
   - Max Loss: $500 (2.0% account)
   - Max Gain: $1,250 (250% R:R)
   - Breakeven: 5912.45
   - TP: 50% (+$625)
   - SL: 100% (-$500)
   - Cut: 13:00 ET

7. Adjust if needed:
   - Click ± on Spread Price to nudge
   - Adjust TP/SL steppers

8. Press "Execute Trade ⌘↵"

9. Watch:
   - "Executing Order..." (pulsing icon)
   - "Position Filled" ✓ (spring animation)

10. Click "Done" → Back to Choose (ready for next scalp)
```

---

## When to Use Each Path

### **Use Discord Alert When:**
- You receive a specific signal with exact strikes/price
- Alert service provides detailed entry specs
- You want to validate the exact alert text

### **Use Saved Preset When:**
- You're trading your standard setup
- You know the market conditions fit your strategy
- You want speed (3 clicks to Preview)
- You're in a productive trading window
- You want consistent sizing/rules

**Pro tip:** Preset is faster for scalping 1-3 trades per block. Discord is better for one-off signals.

---

## Adding Custom Presets (Future)

Not yet implemented, but planned:

```tsx
// Settings → Manage Presets
{
  name: 'My Custom Setup',
  underlying: 'SPY',
  strategy: 'Vertical',
  targetDelta: 60,
  width: 3,
  tpPct: 40,
  slPct: 100,
  timeExit: '14:00',
}
```

For now, use the 3 built-in presets or modify them in code at `/components/CreateTradeV3.tsx` line ~92.

---

## Troubleshooting

### "Can't see Saved Preset option"
- Make sure you're on **"Cinematic Flow"** tab (not "Complete System")
- Should see two cards: Discord Alert | Saved Preset

### "Preview doesn't show risk graph"
- Check that preset selection completed (direction chosen)
- Look for green ✓ on preset card
- Click "Continue to Preview" button

### "Execute button is gray"
- Not implemented in V3 yet (all buttons are active)
- In production, this would show preflight failures

### "Position doesn't appear after fill"
- V3 focuses on execution only
- Post-fill management is in V2 ("Complete System" tab)
- After "Done", you'd go to separate Positions view

---

## Comparison: V2 vs V3

| Feature | V2 Complete System | V3 Cinematic Flow |
|---------|-------------------|-------------------|
| **Discord Paste** | ✅ Tab 1 | ✅ Choose → Paste |
| **Saved Presets** | ✅ Tab 2 | ✅ Choose → Preset |
| **Manual Build** | ✅ Tab 3 | ❌ (future) |
| **Day State HUD** | ✅ Always visible | ❌ (focus mode) |
| **Post-fill Management** | ✅ Change Target/Stop | ❌ (separate view) |
| **Re-arm System** | ✅ Built-in | ❌ (future) |
| **Hero Risk Graph** | ❌ 33% width | ✅ 100% width |
| **Motion Design** | ❌ Static | ✅ Cinematic |
| **Sacred CTA** | ❌ Buried | ✅ Full-width |

**Use V3 for:** Speed, focus, emotional clarity
**Use V2 for:** Full control, multi-position management, exposure tracking

---

## Next Steps

1. ✅ Try the preset flow with SPX 50Δ 10-Wide
2. ⚠️ In production, wire to real broker API
3. ⚠️ Add delta calculations (currently mocked)
4. ⚠️ Build separate Positions view for post-fill management
5. ⚠️ Add Day State HUD as collapsible overlay
6. ⚠️ Wire re-arm system (returns to Preset with template)

---

## Design Philosophy

**V3 = One job done perfectly**
- Paste or Preset → Preview → Execute → Celebrate → Repeat
- No distractions, no clutter
- Risk graph is hero (feel before you act)
- CTA is sacred (impossible to miss)
- Motion is deliberate (cinematic transitions)

This is execution as **art**.
