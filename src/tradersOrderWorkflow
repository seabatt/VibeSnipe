Got it—here’s the **Tastytrade-specific, fast-click SOP** for executing your alert line and adapting on the fly for **0DTE SPX verticals**.

---

# 1) Read the alert in 2s

Example:
`SELL -1 Vertical SPX 100 31 Oct 25 6855/6860 CALL @0.3 LMT`
→ **Bear call credit spread**, **exp: today**, **strikes 6855/6860 (width 5)**, **limit 0.30**, **Qty 1**.

---

# 2) Build the ticket in Tastytrade (Desktop/Web)

**A. Open the order ticket (Table mode)**

1. Enter **SPX** → go **Trade** → **Table**.
2. Click **today’s expiration** to expand the chain.
3. Click **Strategy ▸ Vertical**, then set **Short/Call** (for a bear call). Drag strikes to **6855/6860** (or click to select). ([tastytrade.com][1])

**B. Set price, qty, TIF**
4) **Qty = 1** (double-click to edit).
5) **Order Type = Limit**, **Price = 0.30**, **TIF = Day** (or your preference).
6) (Optional) Toggle **Curve ▸ Analyze** if you want a quick P/L zone visual before sending. ([support.tastytrade.com][2])

**C. Add a Bracket (OCO/OTOCO) so exits are pre-armed**
7) Click **Bracket** (Desktop/Web) → choose **OTOCO** (entry triggers two linked exits).

* **Close at Profit**: set your **profit-take buyback** (e.g., **50–60%** of credit → for 0.30 credit, PT = **0.12–0.15**).
* **Stop Loss**: set **buyback** where loss ≈ **30–40% of max loss** (width − credit). For 5-wide @0.30 ⇒ max loss 4.70; 35% loss ≈ 1.65 → **stop price ≈ 1.95**.
* Confirm bracket links to the spread.
  *(Bracket OCO/OTOCO is supported on options in Tastytrade Desktop/Web.)* ([support.tastytrade.com][3])

**D. Send & chase cleanly**
8) Click **Send** at **Mid**; if no fill in ~2–3s, **Replace** and improve by a **tick** until your slippage cap (e.g., +$0.05–$0.10). Use **Replace Order** (don’t drag multi-legs). ([support.tastytrade.com][4])

> Note: Tastytrade doesn’t offer custom hotkeys; use Replace to speed re-prices. ([support.tastytrade.com][5])

---

# 3) “Shift delta/strikes” routine (market moved / no fill)

**Only change one thing per attempt. Protect the thesis first (strike location), then credit.**

**Step 1 — Re-anchor short strike vs. 6850 level**

* Price **dropping toward 6848/6845** and your **6855/6860** credit collapses → **move down** one strike set to **6850/6855** (keep width 5). Rebuild, set limit, resend with the **same bracket**.
* Price **popping above 6850** and credit is fat but sticky → stay **6855/6860** and improve price inside mid, or **bump to 6860/6865** if you want more cushion and still meet your **min credit**.

**Step 2 — Width (only if needed)**

* Keep **width = 5** for consistency. If credit still too low after one strike move, widen **once** (e.g., **10-wide**) if that’s in your plan—then re-price and resend.

**Step 3 — Two tries max**

* Original try → one re-anchor attempt → if still no clean fill, **skip**. Edge > FOMO.

*(Editing or cancel/replace is the intended path on Tastytrade.)* ([support.tastytrade.com][4])

---

# 4) Platform micro-flows you’ll actually use

* **Replace quickly:** Positions/Activity → **Replace Order** to nudge price (arrow up/down on Active Trader also increments). ([support.tastytrade.com][4])
* **View/close fast:** **Positions** → click the SPX spread group → **Close** or manage your **Bracket** legs. ([support.tastytrade.com][6])
* **Show more strikes:** If you don’t see your 5-point ladder, expand strikes in settings (**# of Strikes**). ([support.tastytrade.com][7])

---

# 5) Your numbers (copy/pin)

* **Max loss** = `width − credit` (×100).
* **PT buyback** = `credit × (1 − PT%)` → 50% of 0.30 → **0.15**.
* **SL buyback** = `credit + f × (width − credit)` → `0.30 + 0.35 × 4.70 ≈ 1.95`.
* **Contracts** = `floor( allowed_$risk / ((width − credit) × 100) )`.

---

# 6) Hard exit discipline (0DTE)

* If PT not hit by your **cutoff (e.g., Noon ET)**, **close** (your studies prefer this).
* Be cautious into late-day **gamma spikes**; bracket helps, but discretion beats hope.

---

If you want, I’ll turn this into a **one-pager “TT Flow Card”** with screenshots (Table/Curve, Bracket window) and blanks for **min credit**, **PT%**, **SL fraction**, **slippage cap**, and **time stop**—ready to print and tape next to your monitor.

[1]: https://tastytrade.com/learn/trading-products/options/short-call-vertical-spread/?utm_source=chatgpt.com "What is a Short Call Vertical Spread & How to Trade It?"
[2]: https://support.tastytrade.com/support/s/solutions/articles/43000435210?utm_source=chatgpt.com "Analysis mode on the tastytrade desktop platform"
[3]: https://support.tastytrade.com/support/s/solutions/articles/43000544221?utm_source=chatgpt.com "How to set up a bracket order (OCO & OTOCO)"
[4]: https://support.tastytrade.com/support/s/solutions/articles/43000435406?utm_source=chatgpt.com "How To Cancel Or Edit A Working Order"
[5]: https://support.tastytrade.com/support/s/solutions/articles/43000460772?utm_source=chatgpt.com "tastytrade platform hotkeys"
[6]: https://support.tastytrade.com/support/s/solutions/articles/43000435418?utm_source=chatgpt.com "Closing an Options Position in tastytrade"
[7]: https://support.tastytrade.com/support/s/solutions/articles/43000532586?utm_source=chatgpt.com "View More Option Strike Prices"
