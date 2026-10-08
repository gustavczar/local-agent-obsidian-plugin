import Phaser from "phaser";
import { COLORS, FURNITURE_KEYS, MARGIN, TILE, WALL_H } from "./officeAssets";

export interface Point { x: number; y: number; }

/** Spots an idle agent can walk to. Derived from where the furniture actually landed,
 *  so the two can never drift apart. */
export interface OfficePoints {
  coffee: Point;
  waterCooler: Point;
  loungeSeats: Point[];
}

/** Draws the static room: floor, walls, border and decoration. Rebuilt only on resize. */
export class RoomBuilder {
  constructor(private scene: Phaser.Scene) {}

  build(roomW: number, roomH: number): OfficePoints {
    this.drawFloor(roomW, roomH);
    this.drawWalls(roomW);
    this.drawRoomBorder(roomW, roomH);
    return this.placeFurniture(roomW, roomH);
  }

  private drawFloor(roomW: number, roomH: number) {
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.floor, 1);
    g.fillRect(0, WALL_H, roomW, roomH - WALL_H);
    g.fillStyle(COLORS.floorAlt, 0.25);
    for (let y = WALL_H; y < roomH; y += TILE) {
      for (let x = 0; x < roomW; x += TILE) {
        if ((x / TILE + y / TILE) % 2 === 0) g.fillRect(x, y, TILE, TILE);
      }
    }
    g.fillStyle(0x000000, 0.1); g.fillRect(0, WALL_H, roomW, 10);
    g.fillStyle(0x000000, 0.05); g.fillRect(0, WALL_H + 10, roomW, 6);
    g.fillStyle(0x000000, 0.04); g.fillRect(0, WALL_H, 6, roomH - WALL_H);
    g.fillRect(roomW - 6, WALL_H, 6, roomH - WALL_H);
    g.fillStyle(0xddc89e, 0.15); g.fillRect(0, roomH - 4, roomW, 4);
    g.setDepth(-2);
  }

  private drawWalls(roomW: number) {
    const g = this.scene.add.graphics();
    g.fillStyle(COLORS.wall, 1); g.fillRect(0, 0, roomW, WALL_H);
    g.fillStyle(0xede2d6, 1); g.fillRect(0, 0, roomW, WALL_H / 3);
    g.fillStyle(COLORS.wallTrim, 1); g.fillRect(0, WALL_H - 5, roomW, 5);
    g.fillStyle(0xc8b8a8, 1); g.fillRect(0, WALL_H - 6, roomW, 1);
    g.setDepth(-1);
  }

  private drawRoomBorder(roomW: number, roomH: number) {
    const g = this.scene.add.graphics();
    const bg = 0x1a1420, pad = 200;
    g.fillStyle(bg, 1);
    g.fillRect(-pad, -pad, roomW + pad * 2, pad);
    g.fillRect(-pad, roomH, roomW + pad * 2, pad);
    g.fillRect(-pad, -pad, pad, roomH + pad * 2);
    g.fillRect(roomW, -pad, pad, roomH + pad * 2);
    g.lineStyle(2, 0x2a2030, 0.8); g.strokeRect(0, 0, roomW, roomH);
    g.setDepth(1000);
  }

  private placeFurniture(roomW: number, roomH: number): OfficePoints {
    const s = this.scene;
    const centerX = roomW / 2;
    const loungeY = roomH - MARGIN - TILE * 0.5;
    const section = roomW / 5;

    // Wall decorations
    s.add.image(section * 0.6, WALL_H + 5, FURNITURE_KEYS.blindsLargeWhite).setOrigin(0.5, 1).setScale(1.8).setDepth(0);
    s.add.image(section * 1.8, WALL_H + 40, FURNITURE_KEYS.bookshelfPurpleTall).setOrigin(0.5, 1).setScale(2).setDepth(0);
    s.add.image(section * 3.2, WALL_H + 40, FURNITURE_KEYS.whiteboardStandGraph).setOrigin(0.5, 1).setScale(2.0).setDepth(0);
    s.add.image(section * 4.4, WALL_H + 5, FURNITURE_KEYS.blindsLargeWhite).setOrigin(0.5, 1).setScale(1.8).setDepth(0);

    // Corner pieces
    s.add.image(MARGIN / 2 + 8, WALL_H + TILE * 2, FURNITURE_KEYS.monstera).setOrigin(0.5, 1).setScale(1.3).setDepth(WALL_H + TILE * 2);
    s.add.image(roomW - MARGIN / 4, WALL_H + TILE * 2, FURNITURE_KEYS.waterCooler).setOrigin(0.5, 1).setScale(1.5).setDepth(WALL_H + TILE * 2 + 1);
    s.add.image(MARGIN / 2, roomH - TILE * 0.5, FURNITURE_KEYS.plant3).setOrigin(0.5, 1).setScale(1.8).setDepth(roomH - TILE * 0.5);
    s.add.image(roomW - MARGIN / 2.5, roomH - TILE * 0.5, FURNITURE_KEYS.plantPoof).setOrigin(0.5, 1).setScale(1.8).setDepth(roomH - TILE * 0.5);
    s.add.image(roomW - MARGIN / 4, roomH - TILE * 2, FURNITURE_KEYS.treasurechestGold).setOrigin(0.5, 1).setScale(1.4).setDepth(1);

    // Mid-wall plants
    const midY = WALL_H + (roomH - WALL_H) / 2;
    s.add.image(MARGIN / 2, midY, FURNITURE_KEYS.monsteraSmall).setOrigin(0.5, 1).setScale(1.5).setDepth(midY);
    s.add.image(roomW - MARGIN / 2, midY, FURNITURE_KEYS.plant1).setOrigin(0.5, 1).setScale(1.5).setDepth(midY);

    // Lounge zone
    s.add.image(centerX, loungeY + TILE * 0.9, FURNITURE_KEYS.fancyRugWide).setOrigin(0.5, 0.5).setScale(0.7).setDepth(-0.5);
    const couchY = loungeY + TILE * 0.3;
    s.add.image(centerX, couchY, FURNITURE_KEYS.couchTanDown).setOrigin(0.5, 1).setScale(1.8).setDepth(couchY);
    s.add.image(centerX - 26, couchY - 28, FURNITURE_KEYS.cushionBlue).setOrigin(0.5, 0.5).setScale(1.5).setDepth(couchY + 1);
    s.add.image(centerX + 26, couchY - 28, FURNITURE_KEYS.cushionTan).setOrigin(0.5, 0.5).setScale(1.5).setDepth(couchY + 1);
    s.add.image(centerX - 95, loungeY + TILE * 0.8, FURNITURE_KEYS.armchairTanDown).setOrigin(0.5, 1).setScale(1.8).setDepth(loungeY + TILE * 0.8);
    s.add.image(centerX + 95, loungeY + TILE * 0.8, FURNITURE_KEYS.armchairTanDown).setOrigin(0.5, 1).setScale(1.8).setDepth(loungeY + TILE * 0.8);
    s.add.image(centerX, loungeY + TILE * 1.5, FURNITURE_KEYS.coffeeTable).setOrigin(0.5, 1).setScale(1.4).setDepth(loungeY + TILE * 1.5);
    s.add.image(centerX + 12, loungeY + TILE * 1.3, FURNITURE_KEYS.coffeeMugBlue).setOrigin(0.5, 1).setDepth(loungeY + TILE * 1.5 + 1);

    // Coffee station
    const stationX = centerX + TILE * 6;
    const stationY = loungeY + TILE * 1.9;
    s.add.image(stationX, stationY, FURNITURE_KEYS.coffeetableBlackH).setOrigin(0.5, 1).setScale(1.5).setDepth(stationY);
    s.add.image(stationX, stationY + 5, FURNITURE_KEYS.coffeepotRight).setOrigin(0.5, 1).setScale(1.2).setDepth(stationY + 1);

    // Stand in front of each piece, not on top of it.
    return {
      coffee: { x: stationX - 34, y: stationY + 16 },
      waterCooler: { x: roomW - MARGIN / 4 - 46, y: WALL_H + TILE * 2 + 26 },
      loungeSeats: [
        { x: centerX - 30, y: couchY + 4 },
        { x: centerX + 30, y: couchY + 4 },
        { x: centerX - 95, y: loungeY + TILE * 0.8 + 4 },
        { x: centerX + 95, y: loungeY + TILE * 0.8 + 4 },
      ],
    };
  }
}
