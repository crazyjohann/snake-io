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
  { id: "emerald", name: "Emerald", color: "#50c878", cost: 150 },
  { id: "obsidian", name: "Obsidian", color: "#3a3a3a", cost: 200 },
  { id: "plasma", name: "Plasma", color: "#ff00ff", cost: 300 },
  { id: "lava", name: "Lava", color: "#ff4500", cost: 400 },
  { id: "ice", name: "Ice", color: "#00ffff", cost: 400 },
  { id: "galaxy", name: "Galaxy", color: "rainbow", cost: 600 },
];

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const myIdRef = useRef<string | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false);
  const [leaderboard, setLeaderboard] = useState<Player[]>([]);
  const [showShop, setShowShop] = useState(false);
  const [showRevive, setShowRevive] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [connectionStatus, setConnectionStatus] = useState<"connecting" | "open" | "closed" | "error">("connecting");

  const me = myId && gameState?.players[myId] ? gameState.players[myId] : null;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setShowShop(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    console.log(`Attempting WebSocket connection to: ${protocol}//${host}`);
    
    const socket = new WebSocket(`${protocol}//${host}`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WebSocket connection established successfully.");
      setConnectionStatus("open");
    };

    socket.onerror = (error) => {
      console.error("WebSocket error occurred:", error);
      setConnectionStatus("error");
    };

    socket.onclose = (event) => {
      console.warn(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      setConnectionStatus("closed");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received message from server:", data.type);
        if (data.type === "init") {
          setMyId(data.id);
          myIdRef.current = data.id;
        } else if (data.type === "room_joined") {
          setCurrentRoom(data.roomId);
          setIsJoined(true);
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

  const handleJoin = (type: "host" | "join" | "random") => {
    if (!playerName.trim()) return;
    if (type === "join" && !roomCode.trim()) return;
    
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ 
        type: "join", 
        name: playerName,
        joinType: type,
        roomId: type === "join" ? roomCode.toUpperCase() : undefined
      }));
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
            <div className="space-y-6">
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

              <div className="grid grid-cols-1 gap-4">
                <button
                  onClick={() => handleJoin("random")}
                  disabled={connectionStatus !== "open" || !playerName.trim()}
                  className="w-full bg-black text-white font-black py-4 px-8 rounded-xl hover:bg-gray-800 transition-all transform hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed uppercase italic"
                >
                  Join Random Room
                </button>
                
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(e) => setRoomCode(e.target.value)}
                    placeholder="ROOM CODE..."
                    className="flex-1 bg-white/50 border-2 border-black/10 rounded-xl p-4 text-black outline-none focus:border-black transition-all text-center font-bold uppercase"
                  />
                  <button
                    onClick={() => handleJoin("join")}
                    disabled={connectionStatus !== "open" || !playerName.trim() || !roomCode.trim()}
                    className="bg-black text-white font-black py-4 px-6 rounded-xl hover:bg-gray-800 transition-all disabled:opacity-50 uppercase italic"
                  >
                    Join
                  </button>
                </div>

                <button
                  onClick={() => handleJoin("host")}
                  disabled={connectionStatus !== "open" || !playerName.trim()}
                  className="w-full bg-white border-2 border-black text-black font-black py-4 px-8 rounded-xl hover:bg-gray-50 transition-all transform hover:scale-105 active:scale-95 shadow-xl disabled:opacity-50 disabled:cursor-not-allowed uppercase italic"
                >
                  Host Private Room
                </button>
              </div>
              {connectionStatus === "error" && (
                <p className="text-red-500 text-xs mt-2 uppercase font-bold">
                  WebSocket connection failed. Ensure you are not on Vercel.
                </p>
              )}
            </div>
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

            <motion.div 
              initial={{ x: -50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-black/5 flex items-center gap-4 shadow-lg"
            >
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600">
                <Users size={24} />
              </div>
              <div>
                <div className="text-[10px] text-black/50 uppercase tracking-widest">Room Code</div>
                <div className="text-xl font-black text-black">{currentRoom}</div>
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
                onClick={() => setShowShop(false)}
                className="absolute inset-0 z-[150] bg-black/40 backdrop-blur-md flex items-center justify-center p-4 md:p-8 cursor-pointer"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  className="max-w-2xl w-full bg-white rounded-[2rem] border border-black/10 p-6 md:p-10 relative shadow-2xl cursor-default overflow-hidden"
                >
                  <button 
                    onClick={() => setShowShop(false)}
                    className="absolute top-6 right-6 p-2 rounded-full hover:bg-black/5 text-black/50 hover:text-black transition-colors z-10"
                    aria-label="Close shop"
                  >
                    <X size={28} />
                  </button>
                  
                  <div className="relative">
                    <h2 className="text-3xl md:text-4xl font-black mb-2 flex items-center gap-4 text-black italic tracking-tighter">
                      <ShoppingBag size={32} className="text-black" /> SKIN REPOSITORY
                    </h2>
                    <p className="text-[10px] text-black/40 uppercase tracking-[0.2em] mb-8 font-bold">Upgrade your visual signature</p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {SKINS.map(skin => (
                        <motion.div 
                          key={skin.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className={`p-5 rounded-2xl border-2 transition-all cursor-pointer flex justify-between items-center group ${
                            me?.skin === skin.id 
                              ? "border-black bg-black text-white" 
                              : "border-black/5 bg-gray-50 hover:border-black/20"
                          }`}
                          onClick={() => buySkin(skin.id)}
                        >
                          <div className="flex items-center gap-4">
                            <div 
                              className="w-10 h-10 rounded-xl shadow-inner border border-white/10" 
                              style={{ background: skin.color === "rainbow" ? "linear-gradient(45deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff)" : skin.color }}
                            />
                            <div>
                              <div className={`font-black text-sm uppercase italic ${me?.skin === skin.id ? "text-white" : "text-black"}`}>{skin.name}</div>
                              <div className={`text-[9px] uppercase tracking-widest font-bold ${me?.skin === skin.id ? "text-white/60" : "text-black/40"}`}>
                                {skin.cost === 0 ? "Standard Issue" : `${skin.cost} Credits`}
                              </div>
                            </div>
                          </div>
                          {me?.skin === skin.id ? (
                            <div className="bg-white text-black px-2 py-1 rounded-md text-[8px] font-black tracking-tighter">ACTIVE</div>
                          ) : (
                            (me?.coins || 0) >= skin.cost && (
                              <div className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-black text-black/40">EQUIP</div>
                            )
                          )}
                        </motion.div>
                      ))}
                    </div>
                    
                    <div className="mt-8 pt-8 border-t border-black/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                      <div className="flex items-center gap-3 bg-yellow-400/10 px-4 py-2 rounded-xl border border-yellow-400/20">
                        <Coins size={20} className="text-yellow-600" /> 
                        <span className="text-yellow-700 font-black text-lg">{me?.coins || 0}</span>
                        <span className="text-[10px] text-yellow-700/60 font-bold uppercase tracking-widest">Available</span>
                      </div>
                      <button 
                        onClick={() => setShowShop(false)}
                        className="w-full sm:w-auto bg-black text-white px-8 py-3 rounded-xl font-black text-sm uppercase italic hover:bg-gray-800 transition-all active:scale-95"
                      >
                        Return to Mission
                      </button>
                    </div>
                  </div>
                </motion.div>
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
