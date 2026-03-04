import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Users, Zap, Skull, ShoppingBag, Coins, Star, RefreshCw, X } from "lucide-react";

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
}

interface GameState {
  players: { [id: string]: Player };
  food: Point[];
  specialFood: Point[];
}

const WORLD_SIZE = 2000;
const SNAKE_RADIUS = 10;

const SKINS = [
  { id: "default", name: "Classic", color: "#00ff00", cost: 0 },
  { id: "neon-blue", name: "Neon Blue", color: "#00f2ff", cost: 50 },
  { id: "crimson", name: "Crimson", color: "#ff0000", cost: 100 },
  { id: "gold", name: "Golden", color: "#ffd700", cost: 250 },
  { id: "rainbow", name: "Rainbow", color: "rainbow", cost: 500 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [showShop, setShowShop] = useState(false);
  const [showRevive, setShowRevive] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const me = myId && gameState?.players[myId] ? gameState.players[myId] : null;

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}`);
    socketRef.current = socket;

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "init") {
          setMyId(data.id);
          myIdRef.current = data.id;
        } else if (data.type === "update") {
          setGameState(data.state);
          const players = Object.values(data.state.players) as Player[];
          setLeaderboard(players.sort((a, b) => b.score - a.score).slice(0, 5));
        }
      } catch (e) {
        console.error("Failed to parse server message", e);
      }
    };

    return () => {
      socket.close();
    };
  }, []);

  useEffect(() => {
    if (myId && gameState?.players[myId] && !gameState.players[myId].isAlive) {
      setShowRevive(true);
    } else {
      setShowRevive(false);
    }
  }, [gameState, myId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isJoined || showShop || !me || !socketRef.current) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const dx = e.clientX - rect.left - centerX;
      const dy = e.clientY - rect.top - centerY;
      const angle = Math.atan2(dy, dx);

      if (socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: "angle", angle }));
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [isJoined, showShop, me]);

  useEffect(() => {
    if (!canvasRef.current || !gameState || !myId) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to window
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const me = gameState.players[myId];
    if (!me || !me.isAlive) return;

    const head = me.segments[0];
    const cameraX = head.x - canvas.width / 2;
    const cameraY = head.y - canvas.height / 2;

    // Draw background
    ctx.fillStyle = "#e0f2f1"; // Light cyan background
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "rgba(0, 0, 0, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 50;
    const startX = -cameraX % gridSize;
    const startY = -cameraY % gridSize;

    for (let x = startX; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw world bounds
    ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
    ctx.lineWidth = 5;
    ctx.strokeRect(-cameraX, -cameraY, WORLD_SIZE, WORLD_SIZE);

    // Draw food
    gameState.food.forEach((f) => {
      ctx.fillStyle = "#ff4081";
      ctx.beginPath();
      ctx.arc(f.x - cameraX, f.y - cameraY, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw special food
    gameState.specialFood?.forEach((f) => {
      const time = Date.now() / 200;
      ctx.fillStyle = `hsl(${time % 360}, 100%, 50%)`;
      ctx.beginPath();
      ctx.arc(f.x - cameraX, f.y - cameraY, 8, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw players
    const sortedPlayers = (Object.values(gameState.players) as Player[]).sort((a, b) => a.score - b.score);
    const topPlayerId = leaderboard[0]?.id;

    sortedPlayers.forEach((player: Player) => {
      if (!player.isAlive) return;

      const isRainbow = player.skin === "rainbow";
      const baseColor = isRainbow ? `hsl(${Date.now() / 5 % 360}, 100%, 50%)` : player.color;
      
      // Draw body segments (back to front)
      for (let i = player.segments.length - 1; i >= 0; i--) {
        const seg = player.segments[i];
        const isHead = i === 0;
        const radius = isHead ? SNAKE_RADIUS + 2 : SNAKE_RADIUS;
        
        if (isRainbow) {
          ctx.fillStyle = `hsl(${(Date.now() / 5 + i * 5) % 360}, 100%, 50%)`;
        } else {
          ctx.fillStyle = baseColor;
        }

        ctx.beginPath();
        ctx.arc(seg.x - cameraX, seg.y - cameraY, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isHead) {
          // Draw eyes
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(seg.x - cameraX - 4, seg.y - cameraY - 4, 4, 0, Math.PI * 2);
          ctx.arc(seg.x - cameraX + 4, seg.y - cameraY - 4, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "black";
          ctx.beginPath();
          ctx.arc(seg.x - cameraX - 4, seg.y - cameraY - 4, 2, 0, Math.PI * 2);
          ctx.arc(seg.x - cameraX + 4, seg.y - cameraY - 4, 2, 0, Math.PI * 2);
          ctx.fill();

          // Draw crown for leader
          if (player.id === topPlayerId) {
            ctx.fillStyle = "#FFD700";
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(seg.x - cameraX - 12, seg.y - cameraY - 15);
            ctx.lineTo(seg.x - cameraX - 6, seg.y - cameraY - 28);
            ctx.lineTo(seg.x - cameraX, seg.y - cameraY - 18);
            ctx.lineTo(seg.x - cameraX + 6, seg.y - cameraY - 28);
            ctx.lineTo(seg.x - cameraX + 12, seg.y - cameraY - 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
          }

          // Draw Sword (Katana) from video
          ctx.save();
          ctx.translate(seg.x - cameraX, seg.y - cameraY);
          ctx.rotate(player.angle + Math.PI / 4);
          ctx.fillStyle = "#e0e0e0";
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 1;
          ctx.fillRect(10, -2, 25, 4); // Blade
          ctx.strokeRect(10, -2, 25, 4);
          ctx.fillStyle = "#8d6e63";
          ctx.fillRect(5, -3, 5, 6); // Guard
          ctx.fillStyle = "#3e2723";
          ctx.fillRect(0, -2, 5, 4); // Handle
          ctx.restore();
        }
      }

      // Draw name
      if (player.segments[0]) {
        ctx.fillStyle = "rgba(0,0,0,0.5)";
        ctx.font = "bold 12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(player.name, player.segments[0].x - cameraX, player.segments[0].y - cameraY - 20);
      }
    });
  }, [gameState, myId, leaderboard]);

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "join", name: playerName }));
      setIsJoined(true);
    }
  };

  const buySkin = (skinId: string) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "buy_skin", skin: skinId }));
    }
  };

  const revive = () => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "revive" }));
    }
  };

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[#e0f2f1] overflow-hidden font-mono">
      <div className="crt-overlay" />
      
      <AnimatePresence>
        {!isJoined && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="z-50 bg-white/80 backdrop-blur-xl p-12 border border-black/10 rounded-3xl text-center max-w-lg w-full shadow-2xl"
          >
            <motion.h1 
              animate={{ textShadow: ["0 0 10px rgba(0,0,0,0.1)", "0 0 20px rgba(0,0,0,0.2)", "0 0 10px rgba(0,0,0,0.1)"] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-6xl font-black mb-8 text-black tracking-tighter uppercase italic"
            >
              SNAKE.IO
            </motion.h1>
            <form onSubmit={handleJoin} className="space-y-8">
              <div className="relative">
                <input
                  type="text"
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="ENTER CODENAME..."
                  className="w-full bg-white/50 border-2 border-black/10 rounded-xl p-4 text-black outline-none focus:border-black transition-all text-center text-xl font-bold"
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full bg-black text-white font-black py-4 px-8 rounded-xl hover:bg-gray-800 transition-all transform hover:scale-105 active:scale-95 shadow-xl"
              >
                START GAME
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {isJoined && (
        <div className="relative w-full h-screen flex items-center justify-center">
          {/* Background Canvas (No Borders) */}
          <canvas
            ref={canvasRef}
            className="fixed inset-0 w-full h-full"
          />

          {/* Floating HUD - Top Left */}
          <div className="absolute top-8 left-8 flex flex-col gap-4 pointer-events-none">
            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-black/5 flex items-center gap-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-full bg-black/5 flex items-center justify-center text-black">
                <Star size={24} />
              </div>
              <div>
                <div className="text-[10px] text-black/50 uppercase tracking-widest">Level {me?.level || 1}</div>
                <div className="text-xl font-black text-black">{me?.name || playerName}</div>
                <div className="w-32 h-1 bg-black/5 rounded-full mt-1 overflow-hidden">
                  <div 
                    className="h-full bg-black" 
                    style={{ width: `${((me?.exp || 0) / ((me?.level || 1) * 100)) * 100}%` }}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-black/5 flex items-center gap-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-full bg-yellow-500/10 flex items-center justify-center text-yellow-600">
                <Coins size={24} />
              </div>
              <div>
                <div className="text-[10px] text-black/50 uppercase tracking-widest">Currency</div>
                <div className="text-xl font-black text-black">{me?.coins || 0} <span className="text-xs text-black/30">CREDITS</span></div>
              </div>
            </motion.div>
          </div>

          {/* Floating Leaderboard - Top Right */}
          <div className="absolute top-8 right-8 pointer-events-none">
            <motion.div 
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="bg-white/80 backdrop-blur-md p-6 rounded-3xl border border-black/5 w-64 shadow-lg"
            >
              <h2 className="text-xs font-black mb-4 flex items-center gap-2 text-black/50 tracking-widest uppercase">
                <Trophy size={14} /> Top Operatives
              </h2>
              <div className="space-y-4">
                {leaderboard.map((p, i) => (
                  <div key={p.id} className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-black/20">{i + 1}</span>
                      <span className="font-bold text-sm text-black">{p.name}</span>
                    </div>
                    <span className="text-xs font-black text-black/50">{p.score}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Bottom Actions */}
          <div className="absolute bottom-8 flex gap-4">
            <button 
              onClick={() => setShowShop(true)}
              className="bg-black text-white hover:bg-gray-800 p-4 rounded-2xl transition-all flex items-center gap-3 font-bold shadow-xl"
            >
              <ShoppingBag size={20} /> SHOP
            </button>
          </div>

          {/* Shop Modal */}
          <AnimatePresence>
            {showShop && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] bg-white/90 backdrop-blur-xl flex items-center justify-center p-8"
              >
                <div className="max-w-2xl w-full bg-white rounded-3xl border border-black/5 p-8 relative shadow-2xl">
                  <button 
                    onClick={() => setShowShop(false)}
                    className="absolute top-6 right-6 text-black/50 hover:text-black"
                  >
                    <X size={24} />
                  </button>
                  <h2 className="text-3xl font-black mb-8 flex items-center gap-4 text-black">
                    <ShoppingBag className="text-black" /> SKIN REPOSITORY
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {SKINS.map(skin => (
                      <div 
                        key={skin.id}
                        className={`p-6 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center ${
                          me?.skin === skin.id ? "border-black bg-black/5" : "border-black/5 bg-black/5 hover:border-black/20"
                        }`}
                        onClick={() => buySkin(skin.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div 
                            className="w-8 h-8 rounded-lg" 
                            style={{ background: skin.color === "rainbow" ? "linear-gradient(45deg, red, orange, yellow, green, blue, indigo, violet)" : skin.color }}
                          />
                          <div>
                            <div className="font-bold text-black">{skin.name}</div>
                            <div className="text-[10px] text-black/50 uppercase tracking-widest">{skin.cost === 0 ? "Unlocked" : `${skin.cost} Credits`}</div>
                          </div>
                        </div>
                        {me?.skin === skin.id && <div className="text-black font-black text-[10px]">ACTIVE</div>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-8 border-t border-black/5 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-yellow-600 font-bold">
                      <Coins size={20} /> {me?.coins || 0} AVAILABLE
                    </div>
                    <div className="text-[10px] text-black/30 uppercase tracking-widest">Select a skin to purchase/equip</div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Revive Modal */}
          <AnimatePresence>
            {showRevive && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="absolute inset-0 z-[110] bg-white/80 backdrop-blur-md flex items-center justify-center"
              >
                <div className="bg-white p-12 rounded-3xl border border-black/5 text-center max-w-sm w-full shadow-2xl">
                  <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mx-auto mb-6">
                    <Skull size={40} />
                  </div>
                  <h2 className="text-4xl font-black text-black mb-2 italic">SYSTEM FAILURE</h2>
                  <p className="text-black/50 mb-8 uppercase tracking-widest text-xs">Connection severed by collision</p>
                  
                  <div className="space-y-4">
                    <button 
                      onClick={revive}
                      disabled={(me?.coins || 0) < 20}
                      className="w-full bg-black text-white font-black py-4 rounded-xl hover:bg-gray-800 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:hover:bg-black"
                    >
                      <RefreshCw size={20} /> REVIVE (20 CREDITS)
                    </button>
                    <button 
                      onClick={() => setIsJoined(false)}
                      className="w-full bg-black/5 text-black/50 font-bold py-4 rounded-xl hover:bg-black/10 transition-all"
                    >
                      ABORT MISSION
                    </button>
                  </div>
                  
                  {(me?.coins || 0) < 20 && (
                    <p className="mt-4 text-red-500 text-[10px] font-bold uppercase">Insufficient credits for revival</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
