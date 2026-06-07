/**
 * 最简 WebRTC 信令服务器
 * 用法: node server.js
 * 监听 ws://0.0.0.0:8080
 *
 * 自动配对前两个连接的客户端（一个手机 + 一个 PC），
 * 转发 offer / answer / ice-candidate。
 */

const WebSocket = require("ws");

const PORT = 8080;
const wss = new WebSocket.Server({ port: PORT });

console.log(`[信令服务器] 启动在 ws://0.0.0.0:${PORT}`);

// 房间：只存两个客户端（手机=offer方, PC=answer方）
let clients = []; // 最多两个 { ws, label }

wss.on("connection", (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[连接] 新客户端: ${ip}`);

  if (clients.length >= 2) {
    // 房间满了，拒绝新连接
    ws.send(JSON.stringify({ type: "error", message: "房间已满" }));
    ws.close();
    return;
  }

  clients.push({ ws, ip });
  const myLabel = clients.length === 1 ? "手机(offer方)" : "PC(answer方)";
  console.log(`[角色] ${ip} → ${myLabel}`);

  // 两人都到齐了，通知 PC 端准备接收
  if (clients.length === 2) {
    console.log("[配对] 两个客户端已配对，准备信令交换");
    clients.forEach((c) =>
      c.ws.send(JSON.stringify({ type: "ready", peers: clients.length }))
    );
  }

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      // 转发给另一个客户端
      const other = clients.find((c) => c.ws !== ws);
      if (other && other.ws.readyState === WebSocket.OPEN) {
        other.ws.send(JSON.stringify(msg));
        console.log(`[转发] ${msg.type}`);
      }
    } catch (e) {
      console.warn("[非法消息]", data.toString().slice(0, 50));
    }
  });

  ws.on("close", () => {
    console.log(`[断开] ${ip}`);
    clients = clients.filter((c) => c.ws !== ws);
    // 通知剩余的人
    clients.forEach((c) =>
      c.ws.send(
        JSON.stringify({ type: "peer-disconnected", message: "对方已断开" })
      )
    );
  });

  ws.on("error", (err) => {
    console.error(`[错误] ${ip}:`, err.message);
  });
});

console.log("[信令服务器] 等待客户端连接...");
