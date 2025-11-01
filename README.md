# VibeSnipe

Precision trading web app for 0DTE SPX / QQQ options scalpers. Compresses signal → structure → execution → management into one calm, tactile surface.

## Tech Stack

- **Next.js 14** - React framework (App Router)
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling with design tokens
- **Zustand** - State management
- **react-plotly.js** - Risk graph visualization
- **lucide-react** - Icons

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env.local
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

See `.env.example` for all available environment variables. Currently, the app uses mocked APIs, so no API credentials are required for basic development.

### Available Variables

- `NEXT_PUBLIC_APP_NAME` - Application name (default: VibeSnipe)
- `NEXT_PUBLIC_APP_ENV` - Environment (development/production)

### Optional (for real API integration)

- `TASTYTRADE_USERNAME` - Tastytrade username
- `TASTYTRADE_PASSWORD` - Tastytrade password
- `TASTYTRADE_ENV` - Environment (sandbox/live)
- `QUOTE_FEED_URL` - WebSocket URL for quote feed
- `QUOTE_FEED_API_KEY` - API key for quote feed

## Project Structure

```
src/
├── app/              # Next.js app router pages
│   ├── layout.tsx    # Root layout with ThemeProvider
│   └── page.tsx      # Main dashboard page
├── components/       # React components
│   ├── TradeEntry/   # Trade entry flows (Discord, Preset, Manual)
│   ├── OrderPreview/ # Order preview and execution
│   ├── RiskGraph.tsx # Risk visualization
│   ├── DayHUD/       # Day discipline HUD
│   ├── Positions/    # Position management
│   └── ui/           # UI primitives (Button, Input, Card, etc.)
├── lib/              # Core libraries
│   ├── quoteBus.ts   # Quote feed (currently mocked)
│   └── tastytrade.ts # Tastytrade API (currently mocked)
├── stores/           # Zustand stores
│   ├── useQuotes.ts  # Quote state management
│   ├── useOrders.ts  # Order state management
│   ├── useSchedule.ts # Schedule state management
│   └── useTheme.ts   # Theme state management
├── styles/           # Design system
│   └── tokens.ts # Design tokens (colors, spacing, etc.)
└── hooks/            # Custom React hooks
    └── useTokens.ts  # Hook for accessing design tokens
```

## Building for Production

### Build Locally

```bash
npm run build
```

This creates an optimized production build in the `.next` directory.

### Start Production Server

```bash
npm start
```

## Deployment

### Vercel (Recommended)

1. Install Vercel CLI:
```bash
npm i -g vercel
```

2. Deploy:
```bash
vercel
```

3. For production:
```bash
vercel --prod
```

Vercel automatically detects Next.js and configures build settings. Set environment variables in the Vercel dashboard.

### Netlify

1. Install Netlify CLI:
```bash
npm i -g netlify-cli
```

2. Create `netlify.toml`:
```toml
[build]
  command = "npm run build"
  publish = ".next"
```

3. Deploy:
```bash
netlify deploy --prod
```

### Custom Server

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

The server runs on port 3000 by default (or the PORT environment variable).

## Features

- **Trade Entry Flows**: Discord paste, scheduled presets, manual build
- **Order Preview**: Live spread pricing, risk metrics, TP/SL configuration
- **Risk Graph**: Interactive P/L visualization with Plotly.js
- **Day HUD**: Block countdown, scalp counter, exposure meters
- **Position Management**: Close, modify targets/stops
- **Theme Support**: Light/Dark/Auto with instant switching
- **Design System**: Token-based styling matching Figma design

## Development Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Documentation

- `TASKS.md` - Engineering tasks and roadmap
- `FIGMA_ALIGNMENT.md` - Design system alignment
- `TRADE_ENTRY_FIGMA_ALIGNMENT.md` - Trade entry component alignment

## License

Private - All rights reserved
