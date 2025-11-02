# VibeSnipe - Complete Build Documentation

**Version:** 0.1.0  
**Status:** MVP Deployed - Core Features Complete, API Integration Mocked  
**Last Updated:** December 2024

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Project Structure](#project-structure)
5. [Core Features Implemented](#core-features-implemented)
6. [Views & Pages](#views--pages)
7. [Components Library](#components-library)
8. [State Management](#state-management)
9. [Design System](#design-system)
10. [API Integration Status](#api-integration-status)
11. [Deployment](#deployment)
12. [Development Setup](#development-setup)
13. [Known Limitations & TODO](#known-limitations--todo)

---

## Project Overview

VibeSnipe is a precision trading web application designed for 0DTE (Zero Days To Expiration) SPX/QQQ options scalpers. The application compresses the trading workflow from signal → structure → execution → management into a single, streamlined interface.

### Key Design Principles

- **Industrial Calm**: Minimalist, Apple-level interface design
- **Frictionless Execution**: Instant trade entry and management
- **Risk-Aware**: Real-time P/L visualization and position sizing
- **Time-Blocked Trading**: Structured 10-minute trading blocks with discipline rules
- **Precision**: Exact spacing, typography, and color matching Figma design system

### Target User

Intraday 0DTE index traders who:
- Execute multiple trades per day
- Use pre-defined trading "blocks" (scheduled windows)
- Require certainty and speed in execution
- Prefer minimalist, distraction-free interfaces

---

## Technology Stack

### Core Framework
- **Next.js 14.2.33** - React framework with App Router
- **React 18.3.0** - UI library
- **TypeScript 5.5.0** - Type safety

### State Management
- **Zustand 5.0.8** - Lightweight state management (4 stores)

### Styling & Design
- **Tailwind CSS 3.4.1** - Utility-first CSS framework
- **PostCSS 8.4.35** - CSS processing
- **Autoprefixer 10.4.18** - Vendor prefixing
- **Design Tokens System** - Custom token-based design system matching Figma

### UI Components & Icons
- **Lucide React 0.344.0** - Icon library (used throughout)
- **Custom UI Primitives** - Button, Input, Card, Chip, Toast, Tooltip, Switch, SegmentedTabs

### Data Visualization
- **Recharts 2.15.0** - React charting library (used in History view)
- **react-plotly.js 2.6.0** - Plotly.js React wrapper (for RiskGraph - partially implemented)
- **Plotly.js 3.2.0** - Advanced charting library (available but not fully integrated)
- **Lightweight-Charts 5.0.9** - High-performance charting (installed but not used yet)

### Animations
- **Motion (Framer Motion) 12.0.0** - Animation library (used for cinematic transitions in CreateTradeV3)

### Utilities
- **clsx 2.1.1** - Conditional class names
- **tailwind-merge 3.3.1** - Tailwind class merging

### Development Tools
- **ESLint** - Code linting (via Next.js)
- **TypeScript** - Static type checking

---

## Architecture

### Rendering Strategy

The application uses **Client-Side Rendering (CSR)** for all main views to prevent hydration mismatches:

- All main views are dynamically imported with `ssr: false`
- Components use `mounted` state patterns to handle browser API access
- Theme and localization handled client-side only

### Routing

- **Single-Page Application (SPA)** with client-side routing
- View-based navigation (not file-based routing for main views)
- Main entry point: `src/app/page.tsx` handles view switching

### State Management Pattern

- **Zustand stores** for global application state
- **React Context** for theme management
- **Local component state** for UI-only concerns
- **No Redux or complex state management** - kept lightweight

### Design System Pattern

- **Token-based styling** - All design values come from `src/styles/tokens.ts`
- **CSS Variables** - Theme colors exposed as CSS variables for Tailwind
- **Component-level styling** - Inline styles using tokens via `useTokens()` hook
- **No CSS-in-JS libraries** - Pure CSS variables + inline styles

---

## Project Structure

```
vibesnipe/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with ThemeProvider
│   │   ├── page.tsx             # Main entry point, view router
│   │   ├── globals.css          # Global styles, CSS variables
│   │   └── demo/                # Demo/testing page (if exists)
│   │
│   ├── components/              # React components
│   │   ├── views/               # Full-page views
│   │   │   ├── Dashboard.tsx    # Main dashboard/home view
│   │   │   ├── CreateTradeV3.tsx # Trade creation flow
│   │   │   ├── PreviewStep.tsx  # Order preview component
│   │   │   ├── History.tsx      # Trade history view
│   │   │   ├── Settings.tsx     # Settings configuration view
│   │   │   └── Library.tsx      # Preset template library
│   │   │
│   │   ├── TradeEntry/          # Trade entry components
│   │   │   ├── index.tsx        # TradeEntry container
│   │   │   ├── DiscordPaste.tsx # Discord alert parser
│   │   │   ├── ManualBuild.tsx  # Manual trade builder
│   │   │   └── PresetEntry.tsx  # Scheduled preset entry
│   │   │
│   │   ├── Navigation.tsx        # Top navigation header
│   │   ├── OrderPreview.tsx     # Order preview panel
│   │   ├── RiskGraph.tsx        # Risk visualization (partial)
│   │   ├── ErrorBoundary.tsx    # Error handling wrapper
│   │   │
│   │   ├── DayHUD/              # Day discipline HUD (partial)
│   │   │   └── index.tsx
│   │   │
│   │   ├── Positions/           # Position management (partial)
│   │   │   └── index.tsx
│   │   │
│   │   ├── providers/           # Context providers
│   │   │   └── ThemeProvider.tsx # Theme context & ThemeToggle
│   │   │
│   │   └── ui/                   # UI primitives
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       ├── Chip.tsx
│   │       ├── Toast.tsx         # Custom toast notifications
│   │       ├── Tooltip.tsx
│   │       ├── Switch.tsx
│   │       ├── SegmentedTabs.tsx
│   │       ├── use-mobile.ts     # Mobile detection hook
│   │       └── index.ts           # Barrel exports
│   │
│   ├── stores/                   # Zustand state stores
│   │   ├── useQuotes.ts          # Real-time quote subscriptions
│   │   ├── useOrders.ts          # Order & position management
│   │   ├── useSchedule.ts        # Trading block schedule
│   │   └── useTheme.ts           # Theme persistence
│   │
│   ├── lib/                      # Core libraries & utilities
│   │   ├── quoteBus.ts          # Mock quote feed (EventEmitter)
│   │   ├── tastytrade.ts        # Mock Tastytrade API
│   │   └── schedule.json        # Trading block schedule data
│   │
│   ├── hooks/                     # Custom React hooks
│   │   └── useTokens.ts          # Design token accessor
│   │
│   ├── styles/                    # Design system
│   │   └── tokens.ts             # Design tokens (colors, spacing, etc.)
│   │
│   ├── types.ts                    # TypeScript type definitions
│   └── types/                      # Additional type definitions
│       └── react-plotly.d.ts      # Plotly type declarations
│
├── public/                        # Static assets (if any)
├── figma-design/                  # Figma design reference files
│
├── package.json                    # Dependencies & scripts
├── tsconfig.json                  # TypeScript configuration
├── next.config.js                 # Next.js configuration
├── tailwind.config.ts             # Tailwind CSS configuration
├── postcss.config.js              # PostCSS configuration
├── vercel.json                    # Vercel deployment config
├── .env.example                   # Environment variable template
└── README.md                      # This file

```

---

## Core Features Implemented

### 1. Multi-View Navigation System

- **Sticky navigation header** with view switching
- **5 main views**: Home (Dashboard), Create Trade, History, Settings, Library
- **Mobile-responsive** navigation with hamburger menu
- **Active view highlighting** with smooth transitions
- **Theme toggle** integrated in navigation

### 2. Dashboard View (Home)

**Location:** `src/components/views/Dashboard.tsx`

**Features:**
- **Today's Roll-up KPIs**: Net P/L, Open P/L, Win Rate, Average TTFF, Average Hold Time
- **Trading Blocks Ribbon**: Visual timeline of scheduled trading blocks with:
  - Current block highlighting
  - Next block preview
  - Block status indicators (eligible/warning/locked)
  - Time remaining countdown
- **Open Positions Table**: List of active positions with:
  - Symbol, Strategy, Quantity
  - Entry Price, Current Price, P/L
  - Target and Stop levels
  - Action buttons (Close, Modify)
- **Account Chip**: Account status indicator
- **Theme Toggle**: Light/Auto/Dark theme switcher
- **Responsive Design**: Mobile and desktop layouts

**State Management:**
- Integrates with `useOrders` store for positions
- Integrates with `useSchedule` store for trading blocks
- Integrates with `useQuotes` store for real-time prices
- Real-time updates via `setInterval` (1 second)

**Status:** ✅ Fully Implemented (with mock data)

### 3. Create Trade Flow

**Location:** `src/components/views/CreateTradeV3.tsx`

**Flow Steps:**
1. **Choose Step**: Entry method selection
   - Discord Paste button
   - Scheduled Preset button
   - Manual Build button

2. **Paste Step**: Discord alert parser
   - Text paste area
   - Automatic parsing of alerts
   - Parsed trade preview
   - Continue/Back navigation

3. **Preset Step**: Scheduled preset selection
   - List of available presets
   - Preset details display
   - Auto-arm status for current block
   - Quick execution for armed presets

4. **Preview Step**: Order review and configuration
   - **Trade Structure Display**: Legs, strikes, quantities
   - **Risk Graph**: P/L visualization (using Recharts)
   - **Position Sizing**: Contract quantity input
   - **Exit Rules Editor**: TP %, SL %, Time Exit
   - **Spread Price Display**: Live calculated spread
   - **Max Loss/Gain**: Risk metrics
   - **Action Buttons**: Execute, Cancel, Nudge (price/strike)

5. **Executing Step**: Order submission animation
   - Loading state with progress
   - Order ID display

6. **Working Step**: Order confirmation
   - Working order details
   - Position creation

**Animations:**
- Uses Framer Motion (`motion/react`) for step transitions
- `AnimatePresence` for enter/exit animations
- Smooth 200ms transitions

**State Management:**
- Uses `useOrders` for pending order
- Uses `useQuotes` for live pricing
- Uses `useSchedule` for preset matching

**Status:** ✅ Fully Implemented (UI complete, API mocked)

### 4. History View

**Location:** `src/components/views/History.tsx`

**Features:**
- **Summary KPI Cards**: Total P/L, Win Rate, Total Trades, Average P/L per Trade
- **Filter Controls**: Date range, Strategy, Underlying, Win/Loss filter
- **Trade History Table**: 
  - Expandable rows with trade details
  - Sortable columns
  - Trade structure visualization
  - Entry/exit prices and times
  - P/L and percentages
- **Performance Over Time Chart**: Line chart using Recharts
- **CSV Export**: Export trade history to CSV
- **Pagination**: (Prepared but not fully implemented)

**Status:** ✅ Fully Implemented (with mock data)

### 5. Settings View

**Location:** `src/components/views/Settings.tsx`

**Tabs (6 total):**

1. **Account Tab**
   - Account information display
   - Connection status
   - API credentials (if needed)

2. **Strategy Defaults Tab**
   - Default take profit %
   - Default stop loss %
   - Default position sizing rules
   - Default delta targets

3. **Discipline & Risk Tab**
   - Max exposure per block
   - Max daily exposure
   - Soft lock rules
   - Hard lock rules
   - Override settings

4. **Schedule Tab**
   - Trading block management
   - Add/Edit/Delete blocks
   - Block time configuration
   - Strategy assignment per block

5. **Visuals & Behavior Tab**
   - Theme preference (Light/Auto/Dark)
   - Animation preferences
   - Display preferences

6. **Advanced Tab**
   - API settings
   - Debug options
   - Logging preferences

**Persistence:**
- Settings stored in `localStorage`
- Form validation
- Toast notifications for saves

**Status:** ✅ Fully Implemented (UI complete, localStorage persistence)

### 6. Library View

**Location:** `src/components/views/Library.tsx`

**Features:**
- **Preset Template Grid**: Visual cards for each template
- **Template Metadata**: Strategy, underlying, delta, width, rules
- **Copy to Clipboard**: One-click copy of template configuration
- **Empty State**: When no templates exist
- **Responsive Grid**: Mobile and desktop layouts

**Status:** ✅ Fully Implemented (with mock templates)

### 7. Theme System

**Location:** `src/components/providers/ThemeProvider.tsx`

**Features:**
- **Three Themes**: Light, Dark, Auto (system preference)
- **Theme Toggle Component**: Icon-based switcher (Sun/Monitor/Moon)
- **Persistent Preference**: Stored in `localStorage`
- **Instant Switching**: < 100ms color transitions
- **CSS Variable Based**: Theme colors as CSS variables
- **No Flash**: Proper SSR handling to prevent flash

**Implementation:**
- Uses React Context for theme state
- Integrates with Zustand `useTheme` store for persistence
- Updates `data-theme` attribute on `<html>` element
- All components use `useTokens()` hook to access theme colors

**Status:** ✅ Fully Implemented

### 8. Design System

**Location:** `src/styles/tokens.ts`

**Token Categories:**

1. **Colors**
   - Dark theme: bg, surface, surfaceAlt, border, textPrimary, textSecondary, subtle
   - Light theme: bg, surface, surfaceAlt, border, textPrimary, textSecondary, subtle
   - Semantic: profit (green), risk (red), info (blue), warning (yellow)

2. **Typography**
   - Font family: Inter with system fallbacks
   - Weights: regular (400), medium (500), semibold (600)
   - Sizes: xs (11px), sm (13px), base (15px), lg (17px), xl (22px), xxl (28px), xxxl (36px)
   - Line heights: tight (1.1), base (1.4), relaxed (1.6)

3. **Spacing**
   - xs: 4px, sm: 8px, md: 12px, lg: 16px, xl: 24px, xxl: 32px, xxxl: 48px

4. **Border Radius**
   - sm: 8px, md: 12px, lg: 16px

5. **Elevation (Shadows)**
   - sm, md, lg (with opacity values)

6. **Motion (Transitions)**
   - fast: 150ms, base: 200ms, smooth: 300ms
   - All use `ease-in-out` timing

**Usage:**
- Components import `useTokens()` hook
- Tokens accessed via `tokens.colors`, `tokens.space`, `tokens.type`, etc.
- CSS variables also available for Tailwind classes

**Status:** ✅ Fully Implemented, Matches Figma Design

### 9. State Management (Zustand Stores)

#### `useQuotes` Store

**Location:** `src/stores/useQuotes.ts`

**Features:**
- Real-time quote subscriptions
- Quote caching per symbol
- EventEmitter-based quote bus
- Subscription management (subscribe/unsubscribe)

**Current Implementation:**
- **Mocked**: Uses `quoteBus` with simulated price drift
- Updates every 500ms
- Symbols supported: SPX, QQQ

**API:**
- `quotes: Map<string, QuoteMsg>` - Current quotes
- `subscribe(symbols: string[])` - Subscribe to symbols
- `unsubscribe()` - Unsubscribe from all
- `getQuote(symbol: string)` - Get quote for symbol

**Status:** ✅ Implemented (Mocked)

#### `useOrders` Store

**Location:** `src/stores/useOrders.ts`

**Features:**
- Pending order management
- Position management (add/update/remove)
- Order state tracking

**API:**
- `pendingOrder: PendingOrder | null` - Current pending order
- `positions: Position[]` - All positions
- `setPendingOrder(order)` - Set pending order
- `addPosition(position)` - Add new position
- `updatePosition(id, updates)` - Update position
- `removePosition(id)` - Remove position

**Status:** ✅ Fully Implemented

#### `useSchedule` Store

**Location:** `src/stores/useSchedule.ts`

**Features:**
- Trading block schedule management
- Current block detection
- Next block calculation
- Active underlying tracking

**Data Source:**
- Loads from `src/lib/schedule.json`
- Blocks defined with: time, strategy, underlying, delta, width, ruleBundle

**API:**
- `blocks: ScheduledBlock[]` - All scheduled blocks
- `currentBlock: ScheduledBlock | null` - Current active block
- `nextBlock: ScheduledBlock | null` - Next upcoming block
- `activeUnderlying: Underlying | null` - Currently selected underlying
- `setActiveUnderlying(underlying)` - Set active underlying
- `getCurrentBlock()` - Calculate current block (based on time)
- `getNextBlock()` - Calculate next block

**Current Block Logic:**
- Finds block where current time is within 10-minute window
- Respects active underlying filter

**Status:** ✅ Fully Implemented

#### `useTheme` Store

**Location:** `src/stores/useTheme.ts`

**Features:**
- Theme persistence in localStorage
- Theme toggle functionality
- Document attribute updates

**API:**
- `theme: 'dark' | 'light'` - Current theme
- `toggle()` - Toggle between dark/light
- `setTheme(theme)` - Set specific theme

**Integration:**
- Used by `ThemeProvider` for persistence
- Synced with `data-theme` attribute on `<html>`

**Status:** ✅ Fully Implemented

---

## Views & Pages

### Main Application Flow

1. **Entry Point**: `src/app/page.tsx`
   - Handles view routing
   - Manages global state initialization
   - Wraps all views in ErrorBoundary

2. **Layout**: `src/app/layout.tsx`
   - Root HTML structure
   - ThemeProvider wrapper
   - Global metadata

### View Details

| View | Component | Status | Key Features |
|------|-----------|--------|--------------|
| **Home** | `Dashboard.tsx` | ✅ Complete | KPIs, Trading Blocks, Open Positions |
| **Create Trade** | `CreateTradeV3.tsx` | ✅ Complete | Multi-step flow, Preview, Execution |
| **History** | `History.tsx` | ✅ Complete | Trade table, Charts, Filters, Export |
| **Settings** | `Settings.tsx` | ✅ Complete | 6 tabs, Form persistence |
| **Library** | `Library.tsx` | ✅ Complete | Template grid, Copy functionality |

---

## Components Library

### UI Primitives

All located in `src/components/ui/`:

| Component | Status | Usage |
|-----------|--------|-------|
| **Button** | ✅ Complete | Primary action buttons throughout |
| **Input** | ✅ Complete | Form inputs, price/strike inputs |
| **Card** | ✅ Complete | Container for content sections |
| **Chip** | ✅ Complete | Status indicators, filters |
| **Toast** | ✅ Complete | Notification system (custom, not sonner) |
| **Tooltip** | ✅ Complete | Hover information |
| **Switch** | ✅ Complete | Toggle controls |
| **SegmentedTabs** | ✅ Complete | Tab navigation |
| **use-mobile** | ✅ Complete | Responsive hook |

### Feature Components

| Component | Status | Purpose |
|-----------|--------|---------|
| **Navigation** | ✅ Complete | Top navigation header with view switching |
| **OrderPreview** | ⚠️ Partial | Order preview panel (legacy, may be replaced) |
| **RiskGraph** | ⚠️ Partial | Risk visualization (basic implementation) |
| **DayHUD** | ⚠️ Partial | Day discipline HUD (basic structure) |
| **Positions** | ⚠️ Partial | Position management panel (basic structure) |
| **ErrorBoundary** | ✅ Complete | React error boundary wrapper |
| **ThemeProvider** | ✅ Complete | Theme context and toggle |

### Trade Entry Components

| Component | Status | Purpose |
|-----------|--------|---------|
| **TradeEntry (index)** | ✅ Complete | Container for entry methods |
| **DiscordPaste** | ✅ Complete | Discord alert parser and UI |
| **ManualBuild** | ✅ Complete | Manual trade builder form |
| **PresetEntry** | ✅ Complete | Scheduled preset selection |

---

## State Management

### Zustand Stores Overview

All stores use Zustand's simple API pattern:

```typescript
import { create } from 'zustand';

export const useStore = create<StoreType>((set, get) => ({
  // State
  data: [],
  
  // Actions
  setData: (data) => set({ data }),
}));
```

### Store Communication

- **No cross-store dependencies** - Stores are independent
- **Components subscribe to multiple stores** as needed
- **No middleware** - Pure Zustand (no persistence middleware, uses localStorage directly)

### Data Flow

```
User Action → Component → Store Action → State Update → Component Re-render
```

Example:
- User clicks "Execute" in CreateTradeV3
- Component calls `useOrders().setPendingOrder(order)`
- Order preview updates
- Position created on execution

---

## Design System

### Token Access Pattern

All components use the `useTokens()` hook:

```typescript
import { useTokens } from '@/hooks/useTokens';

function MyComponent() {
  const tokens = useTokens();
  const colors = tokens.colors;
  
  return (
    <div style={{ 
      backgroundColor: colors.bg,
      color: colors.textPrimary,
      padding: tokens.space.xl,
      fontSize: tokens.type.sizes.base,
    }}>
      Content
    </div>
  );
}
```

### CSS Variables

Theme colors exposed as CSS variables in `src/app/globals.css`:

```css
:root[data-theme="dark"] {
  --bg: #0F1115;
  --surface: #151821;
  --text-primary: #E6E7EB;
  /* ... */
}
```

Available for Tailwind classes:
```tsx
<div className="bg-bg text-text-primary">
```

### Responsive Design

- **Mobile Breakpoint**: 768px
- **Max Content Width**: 1400px
- **Grid System**: 12-column grid with 24px gutters (Figma reference)
- **Baseline**: 8px vertical rhythm

### Accessibility

- **WCAG ≥ 4.5 : 1** contrast ratios
- **Keyboard Navigation**: Full keyboard support
- **Focus Visible**: 2px outline with 2px offset
- **Screen Reader**: Semantic HTML structure

---

## API Integration Status

### Current Status: **MOCKED**

All API integrations are currently mocked for development/testing.

### Mocked Services

#### 1. Quote Feed (`src/lib/quoteBus.ts`)

**Status:** Fully Mocked

**Implementation:**
- EventEmitter-based quote bus
- Simulates price updates every 500ms
- Random price drift (±0.1%)
- Starting prices: SPX ~5100, QQQ ~450

**Real Implementation Needed:**
- WebSocket connection to real quote feed
- Authentication/API keys
- Symbol subscription management
- Error handling and reconnection logic

#### 2. Tastytrade API (`src/lib/tastytrade.ts`)

**Status:** Fully Mocked

**Current Functions:**
- `loginTastytrade()` - Returns mock session
- `placeOrder()` - Returns mock order ID
- `getPositions()` - Returns empty array

**Real Implementation Needed:**
- OAuth authentication
- Real order placement API
- Position fetching API
- Account management API
- Error handling for API failures

### Environment Variables (Not Currently Used)

The following variables are prepared but not actively used:

```
TASTYTRADE_USERNAME=
TASTYTRADE_PASSWORD=
TASTYTRADE_ENV=sandbox|live
QUOTE_FEED_URL=
QUOTE_FEED_API_KEY=
```

### Integration Points

When implementing real APIs, update:

1. **`src/lib/tastytrade.ts`** - Real API calls
2. **`src/lib/quoteBus.ts`** - Real WebSocket connection
3. **`src/components/views/CreateTradeV3.tsx`** - Replace mock execution
4. **`src/stores/useOrders.ts`** - Real position fetching
5. **Error handling** - Add API error states and retry logic

---

## Deployment

### Current Deployment

**Platform:** Vercel  
**Status:** ✅ Deployed to Production  
**URL:** https://vibe-snipe-ary3ve37t-seabatts-projects.vercel.app (or latest deployment URL)

### Deployment Configuration

**File:** `vercel.json`

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".next",
  "framework": "nextjs",
  "installCommand": "npm install",
  "devCommand": "npm run dev"
}
```

### Build Process

1. **Install Dependencies**: `npm install`
2. **Type Checking**: TypeScript compilation
3. **Linting**: ESLint validation
4. **Build**: `next build` creates optimized production bundle
5. **Deploy**: Vercel serves `.next` directory

### Build Output

- **Static Pages**: Generated at build time where possible
- **Client Components**: Bundled with Next.js
- **Code Splitting**: Automatic via dynamic imports
- **Bundle Size**: ~99KB first load JS (shared chunks ~87.7KB)

### Deployment Commands

```bash
# Preview deployment
vercel

# Production deployment
vercel --prod

# View logs
vercel inspect <deployment-url> --logs
```

### Environment Variables in Production

Set in Vercel Dashboard:
- Environment-specific variables
- Secrets (API keys, passwords)
- Build-time variables

---

## Tastytrade API Setup

To enable Tastytrade API integration for local development:

### 1. Install the SDK

Add the official Tastytrade API SDK to your project:

```bash
npm install @tastytrade/api
```

### 2. Configure Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
TASTYTRADE_ENV=sandbox
TASTYTRADE_CLIENT_SECRET=your_secret
TASTYTRADE_REFRESH_TOKEN=your_refresh_token
```

**Variable Descriptions:**
- `TASTYTRADE_ENV`: Set to `'prod'` for production API or `'sandbox'` for testing environment
- `TASTYTRADE_CLIENT_SECRET`: OAuth2 client secret obtained from the Tastytrade Developer Portal
- `TASTYTRADE_REFRESH_TOKEN`: OAuth2 refresh token obtained via Tastytrade OAuth2 authentication flow

**Note:** The `.env.local` file is gitignored and should not be committed to version control.

### 3. Verify SDK Connection

Test the SDK connection in a Node.js REPL:

```bash
# Start Node REPL
node

# Import and test getClient()
const { getClient } = require('./src/lib/tastytrade');
const client = await getClient();

# Print account info (adjust based on actual SDK API)
console.log('Client initialized:', client);
```

Or test via API endpoint:

```bash
# Start development server
npm run dev

# Test authentication endpoint
curl http://localhost:3000/api/tastytrade/auth
```

### 4. OAuth2 Authentication Flow

To obtain your `TASTYTRADE_REFRESH_TOKEN`:

1. Register your application in the [Tastytrade Developer Portal](https://developer.tastytrade.com)
2. Obtain your OAuth2 `CLIENT_SECRET` and `CLIENT_ID`
3. Complete the OAuth2 authorization flow to get a refresh token
4. Store the refresh token in `.env.local`

**Note:** The SDK handles automatic token refresh using the refresh token. You don't need to manage access tokens manually.

### Integration Files

The Tastytrade integration is implemented in:
- `src/lib/tastytrade/` - Core SDK client and utilities
- `src/app/api/tastytrade/` - Next.js API route handlers
- `src/stores/useQuotes.ts` - Quote streaming via SSE
- `src/stores/useOrders.ts` - Order/position updates via SSE

---

## Development Setup

### Prerequisites

- **Node.js**: 18.x or higher
- **npm**: 9.x or higher (or yarn/pnpm)
- **Git**: For version control

### Installation

```bash
# Clone repository
git clone <repository-url>
cd VibeSnipe

# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env.local
```

### Development Scripts

```bash
# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linting
npm run lint
```

### Development Server Features

- **Hot Module Replacement (HMR)**: Instant updates on file changes
- **Error Overlay**: React error overlay in browser
- **Fast Refresh**: React component state preservation
- **TypeScript**: Real-time type checking

### Code Organization

- **Components**: One component per file
- **Stores**: One store per file
- **Types**: Centralized in `src/types.ts`
- **Hooks**: Custom hooks in `src/hooks/`
- **Utils**: Shared utilities in `src/lib/`

### Linting & Formatting

- **ESLint**: Next.js default configuration
- **TypeScript**: Strict mode enabled
- **No Prettier**: Not configured (can be added)

---

## Known Limitations & TODO

### Critical Limitations

1. **API Integration**: All APIs are mocked
   - No real Tastytrade integration
   - No real quote feed connection
   - No real order execution

2. **Data Persistence**: 
   - No backend database
   - Settings stored in localStorage only
   - No user accounts/authentication

3. **Risk Graph**: Basic implementation
   - Uses Recharts, not fully interactive
   - Plotly.js installed but not fully integrated
   - No hover interactions or detailed analysis

4. **Position Management**: Basic structure
   - `Positions` component exists but minimal
   - No advanced position editing
   - No multi-leg position management UI

5. **DayHUD Component**: Basic structure only
   - Component exists but not fully featured
   - No real-time discipline rule enforcement
   - No lock state management UI

### Feature Gaps

1. **Trade Execution**
   - [ ] Real Tastytrade API integration
   - [ ] Order confirmation flows
   - [ ] Fill notifications
   - [ ] Partial fill handling

2. **Quote Feed**
   - [ ] Real WebSocket connection
   - [ ] Option chain data
   - [ ] Greeks (Delta, Gamma, Theta, Vega)
   - [ ] Implied volatility data

3. **Position Management**
   - [ ] Advanced position editing
   - [ ] Position rolling
   - [ ] Multi-leg position management
   - [ ] Position analytics

4. **Risk Management**
   - [ ] Real-time risk calculations
   - [ ] Portfolio-level risk
   - [ ] Exposure limits enforcement
   - [ ] Margin calculations

5. **Schedule & Discipline**
   - [ ] Auto-arm presets at block open
   - [ ] Lock state enforcement
   - [ ] Override functionality
   - [ ] Block performance tracking

6. **History & Analytics**
   - [ ] Real trade history storage
   - [ ] Advanced filtering
   - [ ] Performance analytics
   - [ ] Strategy backtesting

7. **User Management**
   - [ ] User authentication
   - [ ] Multiple accounts
   - [ ] User preferences
   - [ ] Session management

### Technical Debt

1. **Hydration Issues**: Fixed but pattern should be standardized
   - All components should use `mounted` pattern consistently

2. **Component Organization**: Some components in wrong locations
   - `OrderPreview.tsx` may be redundant with `PreviewStep.tsx`
   - Legacy components need cleanup

3. **Type Safety**: Some `any` types may exist
   - Full TypeScript coverage needed
   - Strict null checks

4. **Testing**: No tests currently
   - Unit tests for stores
   - Component tests
   - Integration tests
   - E2E tests

5. **Performance**: No performance optimization
   - Bundle size analysis needed
   - Code splitting optimization
   - Image optimization (if images added)

6. **Error Handling**: Basic error boundaries
   - More granular error handling
   - User-friendly error messages
   - Error logging/reporting

### Design System Gaps

1. **Animation System**: Basic, needs standardization
   - Consistent animation patterns
   - Loading states
   - Skeleton screens

2. **Accessibility**: Basic, needs audit
   - Full keyboard navigation
   - Screen reader testing
   - ARIA labels

3. **Responsive Design**: Basic mobile support
   - Tablet optimization
   - Touch gesture support
   - Mobile-specific UI patterns

---

## Future Development Notes

### Phase 2 Priorities

1. **API Integration**
   - Implement real Tastytrade authentication
   - Connect real quote feed
   - Implement order execution

2. **Data Persistence**
   - Backend API for trade history
   - Database for positions and settings
   - User authentication

3. **Risk Management**
   - Real-time risk calculations
   - Portfolio risk monitoring
   - Exposure limit enforcement

4. **Enhanced UI**
   - Full interactive risk graphs
   - Advanced position management
   - Real-time discipline HUD

### Phase 3 Priorities

1. **Advanced Features**
   - Strategy backtesting
   - Performance analytics
   - Trade journaling

2. **Multi-User Support**
   - User accounts
   - Team collaboration
   - Shared templates

3. **Mobile App**
   - React Native implementation
   - Push notifications
   - Mobile-optimized workflows

---

## Configuration Files

### TypeScript (`tsconfig.json`)

- Strict mode enabled
- Path aliases: `@/` → `src/`
- Excludes `figma-design` folder

### Next.js (`next.config.js`)

- SWC minification enabled
- React strict mode
- Package import optimization for large libraries
- Compression enabled

### Tailwind (`tailwind.config.ts`)

- Content paths configured
- CSS variable-based colors
- Custom spacing/radius values
- Transition duration/timing

### PostCSS (`postcss.config.js`)

- Tailwind CSS plugin
- Autoprefixer plugin

---

## Documentation Files

The project includes several documentation files:

- **`README.md`** (this file) - Complete build documentation
- **`TASKS.md`** - Engineering tasks and roadmap
- **`FIGMA_ALIGNMENT.md`** - Design system alignment notes
- **`TRADE_ENTRY_FIGMA_ALIGNMENT.md`** - Trade entry component alignment
- **`DEPLOY_INSTRUCTIONS.md`** - Deployment guide
- **`POST_DEPLOYMENT_CHECKLIST.md`** - Post-deployment verification

---

## Support & Contact

For questions about the build or future development:

1. Review this README for architecture and feature documentation
2. Check component files for implementation details
3. Review Figma design files in `figma-design/` for design reference
4. Check `TASKS.md` for planned features and TODO items

---

## License

Private - All rights reserved

---

**Last Updated:** December 2024  
**Version:** 0.1.0  
**Status:** MVP Complete - Ready for API Integration Phase
