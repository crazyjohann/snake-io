import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";

const PORT = 3000;
const TICK_RATE = 50; // Faster tick for smoother movement
const WORLD_SIZE = 2000;
const INITIAL_LENGTH = 10;
const SNAKE_SPEED = 5;
const SNAKE_RADIUS = 10;

interface Point {
  x: number;
  y: number;
}

interface Player {
  id: string;
  name: string;
  segments: Point[];
  angle: number;
  color: string;
  score: number;
  isAlive: boolean;
  coins: number;
  level: number;
  exp: number;
  skin: string;
  deathTime?: number;
}

interface GameState {
  players: { [id: string]: Player };
  food: Point[];
  specialFood: Point[];
}

const state: GameState = {
  players: {},
  food: [],
  specialFood: [],
};

const SKINS = {
  default: { color: "#00ff00", cost: 0 },
  "neon-blue": { color: "#00f2ff", cost: 50 },
  crimson: { color: "#ff0000", cost: 100 },
  gold: { color: "#ffd700", cost: 250 },
  rainbow: { color: "rainbow", cost: 500 },
};

const REVIVE_COST = 20;

// Generate random food
function spawnFood(isSpecial = false) {
  const food = {
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
  };
  if (isSpecial) {
    state.specialFood.push(food);
  } else {
    state.food.push(food);
  }
}

// Initial food
for (let i = 0; i < 100; i++) spawnFood();

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  wss.on("connection", (ws: WebSocket) => {
    const id = Math.random().toString(36).substring(7);
    
    ws.on("message", (message: Buffer | string) => {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === "join") {
          const startX = Math.random() * WORLD_SIZE;
          const startY = Math.random() * WORLD_SIZE;
          
          state.players[id] = {
            id,
            name: data.name || `Player ${id}`,
            segments: Array.from({ length: INITIAL_LENGTH }, () => ({
              x: startX,
              y: startY,
            })),
            angle: Math.random() * Math.PI * 2,
            color: "#00ff00",
            score: 0,
            isAlive: true,
            coins: 0,
            level: 1,
            exp: 0,
            skin: "default",
          };
        }

        const player = state.players[id];
        if (!player) return;

        if (data.type === "angle" && typeof data.angle === "number") {
          player.angle = data.angle;
        }
        if (data.type === "buy_skin") {
          const skinKey = data.skin as keyof typeof SKINS;
          const skin = SKINS[skinKey];
          if (skin && player.coins >= skin.cost) {
            player.coins -= skin.cost;
            player.skin = skinKey;
            player.color = skin.color === "rainbow" ? "#FFFFFF" : skin.color;
          }
        }
        if (data.type === "revive") {
          if (player.coins >= REVIVE_COST && !player.isAlive) {
            player.coins -= REVIVE_COST;
            player.isAlive = true;
            player.score = Math.floor(player.score * 0.5); // Keep half score
            const startX = Math.random() * WORLD_SIZE;
            const startY = Math.random() * WORLD_SIZE;
            player.segments = Array.from({ length: INITIAL_LENGTH }, () => ({
              x: startX,
              y: startY,
            }));
          }
        }
      } catch (e) {
        console.error("Failed to parse message", e);
      }
    });

    ws.on("close", () => {
      delete state.players[id];
    });

    ws.send(JSON.stringify({ type: "init", id }));
  });

  // Game Loop
  setInterval(() => {
    const playerIds = Object.keys(state.players);
    
    if (Math.random() < 0.05 && state.specialFood.length < 10) {
      spawnFood(true);
    }

    playerIds.forEach((id) => {
      const player = state.players[id];
      if (!player || !player.isAlive) return;

      const head = player.segments[0];
      if (!head) return;

      const newHead = {
        x: (head.x + Math.cos(player.angle || 0) * SNAKE_SPEED + WORLD_SIZE) % WORLD_SIZE,
        y: (head.y + Math.sin(player.angle || 0) * SNAKE_SPEED + WORLD_SIZE) % WORLD_SIZE,
      };

      // Check collision with food
      const foodIndex = state.food.findIndex(f => {
        const dx = f.x - newHead.x;
        const dy = f.y - newHead.y;
        return Math.sqrt(dx * dx + dy * dy) < SNAKE_RADIUS + 5;
      });

      const specialFoodIndex = state.specialFood.findIndex(f => {
        const dx = f.x - newHead.x;
        const dy = f.y - newHead.y;
        return Math.sqrt(dx * dx + dy * dy) < SNAKE_RADIUS + 8;
      });

      if (foodIndex !== -1) {
        state.food.splice(foodIndex, 1);
        player.score += 10;
        player.exp += 5;
        player.coins += 1;
        spawnFood();
        // Grow every 5 points
        if (player.score % 50 !== 0) player.segments.pop();
      } else if (specialFoodIndex !== -1) {
        state.specialFood.splice(specialFoodIndex, 1);
        player.score += 50;
        player.exp += 25;
        player.coins += 10;
        // Don't pop to grow
      } else {
        player.segments.pop();
      }

      // Level up
      const nextLevelExp = player.level * 100;
      if (player.exp >= nextLevelExp) {
        player.level++;
        player.exp -= nextLevelExp;
      }

      // Check collision with other snakes
      let collision = false;
      playerIds.forEach(otherId => {
        const other = state.players[otherId];
        if (!other.isAlive) return;
        
        other.segments.forEach((seg, idx) => {
          // Skip head collision with self (more forgiving for small snakes)
          const safetyBuffer = Math.max(10, INITIAL_LENGTH);
          if (otherId === id && idx < safetyBuffer) return;
          
          const dx = seg.x - newHead.x;
          const dy = seg.y - newHead.y;
          if (Math.sqrt(dx * dx + dy * dy) < SNAKE_RADIUS) {
            collision = true;
          }
        });
      });

      if (collision) {
        player.isAlive = false;
        player.deathTime = Date.now();
      } else {
        player.segments.unshift(newHead);
      }
    });

    // Broadcast state
    const payload = JSON.stringify({ type: "update", state });
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }, TICK_RATE);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
