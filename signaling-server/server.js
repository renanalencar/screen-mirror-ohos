/**
 * Minimal WebRTC Signaling Server
 * Usage: node server.js
 * Listening on ws://0.0.0.0:8080
 *
 * Automatically pairs the first two connected clients (one Mobile + one PC),
 * forwards offer / answer / ice-candidate.
 */

const WebSocket = require("ws");

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[Signaling Server] Started on ws://0.0.0.0:${PORT}`);

// Keep-alive heartbeat (prevents OpenHarmony client timeout) and removes dead connections
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) {
      clients = clients.filter((c) => c.ws !== ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 10000);

// Room: only stores two clients (Mobile=offer side, PC=answer side)
let clients = []; // Max two { ws, label }

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  const ip = req.socket.remoteAddress;
  
  // Parse role from query string
  const url = new URL(req.url, 'http://localhost');
  const role = url.searchParams.get("role");

  // If a client with the same role already exists, replace it
  if (role) {
    const existing = clients.find(c => c.role === role);
    if (existing) {
      console.log(`[Role] Replacing old ${role}`);
      existing.ws.close();
      clients = clients.filter(c => c !== existing);
    }
  }

  if (clients.length >= 2) {
    // Room is full, reject new connection
    ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
    ws.close();
    return;
  }

  clients.push({ ws, ip, role });
  const myLabel = role === "sender" ? "Mobile(offer side)" : (role === "receiver" ? "PC(answer side)" : "Unknown");
  console.log(`[Connection] New client: ${ip} → ${myLabel}`);

  // Both arrived, notify PC side to prepare to receive
  if (clients.length === 2) {
    console.log("[Pairing] Two clients paired, preparing for signaling exchange");
    clients.forEach((c) =>
      c.ws.send(JSON.stringify({ type: "ready", peers: clients.length }))
    );
  }

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // Forward to the other client
      const other = clients.find((c) => c.ws !== ws);
      if (other && other.ws.readyState === WebSocket.OPEN) {
        other.ws.send(JSON.stringify(msg));
        console.log(`[Forward] ${msg.type}`);
      }
    } catch (e) {
      console.warn("[Invalid Message]", data.toString().slice(0, 50));
    }
  });

  ws.on("close", () => {
    console.log(`[Disconnected] ${ip}`);
    clients = clients.filter((c) => c.ws !== ws);
    // Notify the remaining client
    clients.forEach((c) =>
      c.ws.send(
        JSON.stringify({ type: "peer-disconnected", message: "Peer disconnected" })
      )
    );
  });

  ws.on("error", (err) => {
    console.error(`[Error] ${ip}:`, err.message);
  });
});

console.log("[Signaling Server] Waiting for clients to connect...");
