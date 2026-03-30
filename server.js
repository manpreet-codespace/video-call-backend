import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

const app = express();

app.use(express.json());
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: "*" }
});

const roomCounts = new Map();

const getRoomSize = (roomId) => roomCounts.get(roomId) ?? 0;

io.on("connection", (socket) => {
    console.log("user connected", socket.id);

    socket.on("join-call", (payload = {}) => {
        const { roomId } = payload;

        if (!roomId) {
            return;
        }

        socket.join(roomId);
        const nextCount = getRoomSize(roomId) + 1;
        roomCounts.set(roomId, nextCount);
        socket.emit("room-state", { participantCount: nextCount });

        if (nextCount > 1) {
            socket.to(roomId).emit("participant-joined");
        }
    });

    socket.on("offer", (payload = {}) => {
        const { roomId, offer } = payload;

        if (!roomId || !offer) {
            return;
        }

        socket.to(roomId).emit("offer", { offer });
    });

    socket.on("answer", (payload = {}) => {
        const { roomId, answer } = payload;

        if (!roomId || !answer) {
            return;
        }

        socket.to(roomId).emit("answer", { answer });
    });

    socket.on("ice-candidate", (payload = {}) => {
        const { roomId, candidate } = payload;

        if (!roomId || !candidate) {
            return;
        }

        socket.to(roomId).emit("ice-candidate", { candidate });
    });

    socket.on("end-call", (payload = {}) => {
        const { roomId } = payload;

        if (!roomId) {
            return;
        }

        socket.to(roomId).emit("call-ended");
    });

    socket.on("leave-call", (payload = {}) => {
        const { roomId } = payload;

        if (!roomId) {
            return;
        }

        socket.leave(roomId);
        const nextCount = Math.max(getRoomSize(roomId) - 1, 0);

        if (nextCount === 0) {
            roomCounts.delete(roomId);
        } else {
            roomCounts.set(roomId, nextCount);
        }
    });

    socket.on("disconnecting", () => {
        socket.rooms.forEach((roomId) => {
            if (roomId === socket.id) {
                return;
            }

            const nextCount = Math.max(getRoomSize(roomId) - 1, 0);

            if (nextCount === 0) {
                roomCounts.delete(roomId);
            } else {
                roomCounts.set(roomId, nextCount);
            }

            socket.to(roomId).emit("call-ended");
        });
    });

    socket.on("disconnect", () => {
        console.log("user disconnected", socket.id);
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`server is listening on port ${PORT}`);
});

server.get("/", (req, res) => {
  res.send("Backend is running");
});
