import { WebSocketTransport } from "@colyseus/ws-transport";
import { RedisPresence, Server } from "colyseus";
import express from "express";
import { createServer } from "http";
import { MongooseDriver } from "./mongo-driver";
import { MatchLobby } from "./rooms/MatchLobbyRoom";
import { MyRoom } from "./rooms/MyRoom";
const port = Number(process.env.port) || 2567;

const app = express();
app.use(express.json());

const gameServer = new Server({
  presence: new RedisPresence(),
  driver: new MongooseDriver("mongodb://127.0.0.1:27017/game_room"),
  transport: new WebSocketTransport({
    /* transport options */
    server: createServer(app),
    
  }),
});

gameServer.define("game", MyRoom);
gameServer.define("lobby", MatchLobby);
gameServer.listen(port);
