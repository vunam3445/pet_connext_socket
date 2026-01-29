const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3001;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // React FE
    methods: ["GET", "POST"],
  },
});
const onlineUsers = new Map(); // userId -> socketId


io.on("connection", (socket) => {
  console.log(" Client connected:", socket.id);

  // khi user báo online
  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);

    // gửi danh sách mới cho tất cả client
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  // join phòng chat
  socket.on("join_room", (conversationId) => {
    socket.join(conversationId);
    console.log(`👉 User ${socket.id} joined room ${conversationId}`);
  });

  // khi user disconnect
  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });
});

// Laravel sẽ gọi API này để phát tin nhắn
app.post("/broadcast", (req, res) => {
  const payload = req.body;
  if (!payload?.conversationId) {
    return res.status(400).json({ error: "conversationId required" });
  }
  io.to(payload.conversationId).emit("receive_message", payload);
  res.json({ ok: true });
});

// API này để Laravel gọi sang khi có thông báo mới (Follow, Post, Like...)
app.post("/broadcast-notification", (req, res) => {
  const { receiver_id, notification } = req.body;

  if (!receiver_id) {
    return res.status(400).json({ error: "receiver_id required" });
  }

  // Lấy socketId từ Map dựa trên userId người nhận
  const socketId = onlineUsers.get(receiver_id);

  if (socketId) {
    // Nếu user đang online, gửi sự kiện "new_notification"
    io.to(socketId).emit("new_notification", notification);
    console.log(`🔔 Notification sent to User ${receiver_id}`);
  } else {
    console.log(`😴 User ${receiver_id} is offline. Skipping real-time emit.`);
  }

  res.json({ ok: true });
});


server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running at http://localhost:${PORT}`);
});
