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

// Khi client kết nối
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("join_room", (conversationId) => {
    socket.join(conversationId);
    console.log(`👉 User ${socket.id} joined room ${conversationId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
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

io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  socket.on("user_online", (userId) => {
    onlineUsers.set(userId, socket.id);

    // gửi danh sách mới cho tất cả client
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });

  socket.on("disconnect", () => {
    for (let [uid, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(uid);
        break;
      }
    }
    io.emit("online_users", Array.from(onlineUsers.keys()));
  });
});


server.listen(PORT, () => {
  console.log(`🚀 WebSocket server running at http://localhost:${PORT}`);
});
