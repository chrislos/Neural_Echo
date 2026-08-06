const WebSocket = require("ws");

const ws = new WebSocket("ws://localhost:8080");

ws.on("open", () => console.log("Connected to headtracker_bridge"));
ws.on("message", (data) => console.log(data.toString()));
ws.on("error", (err) => console.error("Error:", err.message));
ws.on("close", () => console.log("Disconnected"));
