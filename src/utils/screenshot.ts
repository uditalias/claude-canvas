import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function saveScreenshot(base64Data: string): string {
  const dir = path.join(os.tmpdir(), "claude-canvas");
  fs.mkdirSync(dir, { recursive: true });
  const filename = `canvas-${Date.now()}.png`;
  const filepath = path.join(dir, filename);
  const buffer = Buffer.from(base64Data.replace(/^data:image\/png;base64,/, ""), "base64");
  fs.writeFileSync(filepath, buffer);
  return filepath;
}
