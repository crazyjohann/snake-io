# Retro Snake.io

A real-time multiplayer snake game with a modern-retro CRT aesthetic, continuous 360-degree movement, and a leveling/skin system.

## Features

- **Real-time Multiplayer:** Play with other operatives in a shared 2000x2000 world.
- **Continuous Movement:** Smooth 360-degree aiming and movement controlled by your mouse.
- **Progression System:** Earn XP and level up by consuming food and defeating others.
- **Skin Repository:** Unlock and equip unique skins (including Neon, Gold, and Rainbow) using earned credits.
- **Revival System:** Use your hard-earned credits to jump back into the action after a collision.
- **Dynamic Camera:** The view follows your operative's head for a fluid experience.
- **Retro Aesthetic:** CRT scanline effects, bold typography, and a clean light-mode theme.
- **Leaderboard:** Compete for the top spot and earn the leader's crown.

## Tech Stack

- **Frontend:** React 19, Tailwind CSS 4, Motion (Framer Motion), Lucide React.
- **Backend:** Node.js, Express, WebSockets (ws).
- **Build Tool:** Vite.

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm

### Installation

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```

### Running the Game

To start the development server (both frontend and backend):
```bash
npm run dev
```

The game will be available at `http://localhost:3000`.

### Building for Production

To create a production build:
```bash
npm run build
npm start
```

## Controls

- **Movement:** Move your mouse to aim your operative.
- **Join:** Enter your codename and click "Start Game".
- **Shop:** Click the "Shop" button to browse and equip skins.
- **Revive:** If you crash, you can spend 20 credits to revive.

## License

MIT
