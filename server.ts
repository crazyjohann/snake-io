import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import path from "path";

const PORT = Number(process.env.PORT) || 3000;
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
  isNPC?: boolean;
}

interface Room {
  id: string;
  players: { [id: string]: Player };
  food: Point[];
  specialFood: Point[];
  lastUpdate: number;
}

const rooms: { [id: string]: Room } = {};

const SKINS = {
  default: { color: "#00ff00", cost: 0 },
  "neon-blue": { color: "#00f2ff", cost: 50 },
  crimson: { color: "#ff0000", cost: 100 },
  gold: { color: "#ffd700", cost: 250 },
  rainbow: { color: "rainbow", cost: 500 },
  emerald: { color: "#50c878", cost: 150 },
  obsidian: { color: "#3a3a3a", cost: 200 },
  plasma: { color: "#ff00ff", cost: 300 },
  lava: { color: "#ff4500", cost: 400 },
  ice: { color: "#00ffff", cost: 400 },
  galaxy: { color: "rainbow", cost: 600 },
};

const REVIVE_COST = 20;

// Generate random food for a specific room
function spawnFood(room: Room, isSpecial = false) {
  const food = {
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
  };
  if (isSpecial) {
    room.specialFood.push(food);
  } else {
    room.food.push(food);
  }
}

function createRoom(roomId: string): Room {
  const room: Room = {
    id: roomId,
    players: {},
    food: [],
    specialFood: [],
    lastUpdate: Date.now(),
  };
  
  // Initial food
  for (let i = 0; i < 100; i++) spawnFood(room);
  
  // Add some NPCs
  for (let i = 0; i < 5; i++) {
    spawnNPC(room);
  }
  
  rooms[roomId] = room;
  return room;
}

function spawnNPC(room: Room) {
  const id = `npc_${Math.random().toString(36).substring(7)}`;
  const startX = Math.random() * WORLD_SIZE;
  const startY = Math.random() * WORLD_SIZE;
  
  room.players[id] = {
    id,
    name: `Bot ${Math.floor(Math.random() * 1000)}`,
    segments: Array.from({ length: INITIAL_LENGTH }, () => ({
      x: startX,
      y: startY,
    })),
    angle: Math.random() * Math.PI * 2,
    color: Object.values(SKINS)[Math.floor(Math.random() * Object.values(SKINS).length)].color,
    score: 0,
    isAlive: true,
    coins: 0,
    level: 1,
    exp: 0,
    skin: "default",
    isNPC: true,
  };
}

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
    let currentRoomId: string | null = null;
    
    ws.on("message", (message: any) => {
      try {
        const messageString = message.toString();
        const data = JSON.parse(messageString);
        
        if (data.type === "join") {
          let roomId = data.roomId;
          console.log(`Player ${id} joining with type ${data.joinType} and roomId ${roomId}`);
          
          if (data.joinType === "random") {
            const availableRooms = Object.keys(rooms).filter(rid => Object.keys(rooms[rid].players).length < 20);
            roomId = availableRooms.length > 0 ? availableRooms[Math.floor(Math.random() * availableRooms.length)] : Math.random().toString(36).substring(7).toUpperCase();
          } else if (!roomId) {
            roomId = Math.random().toString(36).substring(7).toUpperCase();
          }
          
          let room = rooms[roomId];
          if (!room) {
            room = createRoom(roomId);
          }
          
          currentRoomId = roomId;
          (ws as any).roomId = roomId;
          const startX = Math.random() * WORLD_SIZE;
          const startY = Math.random() * WORLD_SIZE;
          
          room.players[id] = {
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
          
          ws.send(JSON.stringify({ type: "room_joined", roomId }));
          console.log(`Player ${id} successfully joined room ${roomId}`);
        }

        if (!currentRoomId) return;
        const room = rooms[currentRoomId];
        if (!room) return;
        
        const player = room.players[id];
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
      if (currentRoomId && rooms[currentRoomId]) {
        delete rooms[currentRoomId].players[id];
        // Clean up empty rooms (except maybe some persistent ones if needed)
        if (Object.keys(rooms[currentRoomId].players).filter(pid => !rooms[currentRoomId].players[pid].isNPC).length === 0) {
          delete rooms[currentRoomId];
        }
      }
    });

    ws.send(JSON.stringify({ type: "init", id }));
  });

  // Game Loop
  setInterval(() => {
    Object.values(rooms).forEach(room => {
      const playerIds = Object.keys(room.players);
      
      if (Math.random() < 0.05 && room.specialFood.length < 10) {
        spawnFood(room, true);
      }

      playerIds.forEach((id) => {
        const player = room.players[id];
        if (!player || !player.isAlive) {
          // Respawn NPCs if they are dead for a while
          if (player && player.isNPC && player.deathTime && Date.now() - player.deathTime > 5000) {
            delete room.players[id];
            spawnNPC(room);
          }
          return;
        }

        // NPC AI
        if (player.isNPC) {
          // Find nearest food
          let nearestFood = null;
          let minDist = Infinity;
          [...room.food, ...room.specialFood].forEach(f => {
            const dx = f.x - player.segments[0].x;
            const dy = f.y - player.segments[0].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist) {
              minDist = dist;
              nearestFood = f;
            }
          });

          if (nearestFood) {
            const targetAngle = Math.atan2(nearestFood.y - player.segments[0].y, nearestFood.x - player.segments[0].x);
            // Smoothly turn towards food
            let angleDiff = targetAngle - player.angle;
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            player.angle += angleDiff * 0.1;
          }
          
          // Avoid other snakes (very simple avoidance)
          playerIds.forEach(otherId => {
            if (otherId === id) return;
            const other = room.players[otherId];
            if (!other || !other.isAlive) return;
            
            const head = player.segments[0];
            other.segments.forEach(seg => {
              const dx = seg.x - head.x;
              const dy = seg.y - head.y;
              const dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < 50) {
                player.angle += Math.PI / 4; // Turn away
              }
            });
          });
        }

        const head = player.segments[0];
        if (!head) return;

        const newHead = {
          x: (head.x + Math.cos(player.angle || 0) * SNAKE_SPEED + WORLD_SIZE) % WORLD_SIZE,
          y: (head.y + Math.sin(player.angle || 0) * SNAKE_SPEED + WORLD_SIZE) % WORLD_SIZE,
        };

        // Check collision with food
        const foodIndex = room.food.findIndex(f => {
          const dx = f.x - newHead.x;
          const dy = f.y - newHead.y;
          return Math.sqrt(dx * dx + dy * dy) < SNAKE_RADIUS + 5;
        });

        const specialFoodIndex = room.specialFood.findIndex(f => {
          const dx = f.x - newHead.x;
          const dy = f.y - newHead.y;
          return Math.sqrt(dx * dx + dy * dy) < SNAKE_RADIUS + 8;
        });

        if (foodIndex !== -1) {
          room.food.splice(foodIndex, 1);
          player.score += 10;
          player.exp += 5;
          player.coins += 1;
          spawnFood(room);
          if (player.score % 50 !== 0) player.segments.pop();
        } else if (specialFoodIndex !== -1) {
          room.specialFood.splice(specialFoodIndex, 1);
          player.score += 50;
          player.exp += 25;
          player.coins += 10;
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
          const other = room.players[otherId];
          if (!other || !other.isAlive) return;
          
          other.segments.forEach((seg, idx) => {
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

      // Broadcast state to room players
      const payload = JSON.stringify({ 
        type: "update", 
        state: { 
          players: room.players, 
          food: room.food, 
          specialFood: room.specialFood 
        } 
      });
      
      wss.clients.forEach((client: any) => {
        if (client.readyState === WebSocket.OPEN && client.roomId === room.id) {
          client.send(payload);
        }
      });
    });
  }, TICK_RATE);

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
