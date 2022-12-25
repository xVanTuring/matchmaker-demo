import { Schema, Context, type } from "@colyseus/schema";

export class MyRoomState extends Schema {
  @type("string") color: string = "";
  constructor() {
    super();
    this.color = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(
      Math.random() * 255
    )},${Math.floor(Math.random() * 255)})`;
  }
}
