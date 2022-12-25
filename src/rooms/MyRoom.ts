import { Client, Delayed, Room } from "colyseus";
import { IncomingMessage } from "http";
import { MyRoomState } from "./schema/MyRoomState";

export class MyRoom extends Room<MyRoomState> {
  async onCreate(options: any) {
    this.setState(new MyRoomState());
    await this.lock();
    this.autoDispose = false;
    this.clock.setTimeout(async () => {
      if (this.clientCount < 3) {
        console.error(`${this.roomId} Room is not full by 4 seconds open now`);
        await this.unlock();
      }
    }, 3000);
  }
  clientCount = 0;
  onAuth(client: Client, options: any, request?: IncomingMessage) {
    if (this.clientCount > 3) {
      console.error("Room is full, but matchmaker is still pushing player");
      throw new Error("Room is full, but matchmaker is still pushing player");
    }
    return options;
  }
  sendAllClientsInfo() {
    this.broadcast(
      "clients",
      this.clients.map((client) => {
        return {
          name: client.auth?.name ?? "Noname",
        };
      })
    );
  }
  async onJoin(client: Client, options: any) {
    this.clientCount++;
    if (this.clientCount >= 3) {
      await this.lock();
    }
    this.sendAllClientsInfo();
  }
  disposeDelay: Delayed | null = null;
  async onLeave(client: Client, consented: boolean) {
    this.startDisposeDelay();
    this.clientCount--;
    this.sendAllClientsInfo();
    await this.unlock();
  }
  startDisposeDelay() {
    this.disposeDelay?.clear();
    this.disposeDelay?.reset();
    if (this.clientCount === 0) {
      this.disposeDelay = this.clock.setTimeout(() => {
        if (this.clientCount === 0) {
          this.disconnect();
        }
      }, 3000);
    }
  }

  onDispose() {
    console.log(Date.now(), "game room", this.roomId, "disposing...");
  }

  leftHolder() {
    this.startDisposeDelay();
    return Math.max(3 - this.clientCount, 0);
  }
}
