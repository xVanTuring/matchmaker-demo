import { Client, matchMaker, Room } from "colyseus";
interface ClientInfo {
  client: Client;
  name: string;
  matched: boolean;
}

interface Group {
  players: [ClientInfo | null, ClientInfo | null, ClientInfo | null];
  emptySeat: number;
}
function addToGroup(player: ClientInfo, group: Group) {
  const emptyIdx = group.players.findIndex((p) => p == null);
  if (emptyIdx == -1) {
    throw new Error("No Empty Seat for group");
  }
  group.players[emptyIdx] = player;
  group.emptySeat--;
}
function makeGroup(player1: ClientInfo, player2: ClientInfo | null = null) {
  return {
    players: [player1, player2, null],
    emptySeat: player2 == null ? 2 : 1,
  } as Group;
}
export class MatchLobby extends Room {
  clientInfoList: ClientInfo[] = [];

  onCreate(options: any) {
    this.autoDispose = false;
    this.maxClients = 21;
    this.setSimulationInterval(() => {
      this.makeMatch();
    }, 2000);
    this.onMessage("confirm", (client, msg) => {
      client.leave();
    });
  }
  async makeMatch() {
    const freePlayers = [
      ...this.clientInfoList.filter((client) => !client.matched),
    ];
    let firstPlayer = null;
    const groups: Group[] = [];

    if (freePlayers.length === 0) return;
    const openingRoom = await matchMaker.query({
      locked: false,
      name: "game",
    });

    for (const room of openingRoom) {
      let leftHolder = 0;
      try {
        const result = await matchMaker.remoteRoomCall(
          room.roomId,
          "leftHolder"
        );
        leftHolder = Number(result);
      } catch (error) {
        continue;
      }

      while (leftHolder > 0 && freePlayers.length > 0) {
        leftHolder--;
        const player = freePlayers.pop();
        if (player == null) continue;
        try {
          const seat = await matchMaker.reserveSeatFor(room, {
            name: player.name,
          });
          player.matched = true;
          player.client.send("seat", seat);
          // this.clock.setTimeout(() => {
          //   player.matched = false;
          // }, 3000);
        } catch (error) {
          console.error("failed to resolve a seat");
          player.matched = false;
          freePlayers.unshift(player);
        }
      }
    }

    while (freePlayers.length > 0) {
      const player = freePlayers.pop();
      if (player == null) break;

      if (player === firstPlayer) {
        freePlayers.unshift(player);
        break;
      }
      const tmpGroup = makeGroup(player);
      while (tmpGroup.emptySeat > 0 && freePlayers.length > 0) {
        const anotherPlayer = freePlayers.pop();
        addToGroup(anotherPlayer, tmpGroup);
      }
      if (tmpGroup.emptySeat === 0) {
        if (firstPlayer != null && tmpGroup.players.includes(firstPlayer)) {
          firstPlayer == null;
        }
        groups.push(tmpGroup);
      } else if (tmpGroup.emptySeat === 1) {
        if (firstPlayer != null && tmpGroup.players.includes(firstPlayer)) {
          firstPlayer == null;
        }
        groups.push(tmpGroup);
      } else {
        freePlayers.unshift(player);
        if (firstPlayer == null) firstPlayer = player;
      }
    }
    for (const group of groups) {
      if (group.emptySeat > 0) {
        const clientInfo = group.players
          .filter((p) => p != null)
          .map((p) => {
            return { name: p.name };
          });
        group.players
          .filter((player) => player != null)
          .forEach((client) => {
            client.client.send("clients", clientInfo);
          });
        return;
      }
      const newRoom = await matchMaker.createRoom("game", {});
      await Promise.all(
        group.players.map(async (player) => {
          try {
            player.matched = true;
            const seat = await matchMaker.reserveSeatFor(newRoom, {
              name: player.name,
            });
            console.log(
              `${newRoom.roomId} Seat send to ${player.name} at ${Date.now()}`
            );
            player.client.send("seat", seat);
          } catch (error) {
            console.error(error, "unable to reserve seat for new game");
          }
        })
      );
    }
  }

  onJoin(client: Client, options: any) {
    this.clientInfoList.push({
      client: client,
      matched: false,
      name: options.name,
    });
    client.send("clients", [{ name: options.name }]);
  }

  onLeave(client: Client, consented: boolean) {
    const idx = this.clientInfoList.findIndex((info) => info.client === client);
    this.clientInfoList.splice(idx, 1);
  }

  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }
}
