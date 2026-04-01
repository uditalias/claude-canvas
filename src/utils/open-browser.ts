import { exec } from "child_process";

export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  const cmd =
    platform === "darwin" ? `open "${url}"` :
    platform === "win32" ? `start "" "${url}"` :
    `xdg-open "${url}"`;
  return new Promise((resolve) => {
    exec(cmd, (err) => {
      if (err) console.log(`Could not open browser automatically. Navigate to: ${url}`);
      resolve();
    });
  });
}
