import fs from "fs";
import path from "path";

export function getHandlerFiles(dir: string): string[] {
  let results: string[] = [];

  function traverseDirectory(currentDir: string) {
    const list = fs.readdirSync(currentDir);
    list.forEach((file) => {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      if (stat && stat.isDirectory()) {
        traverseDirectory(filePath);
      } else {
        if (
          (file.endsWith(".ts") || file.endsWith(".js")) &&
          !file.endsWith(".d.ts")
        ) {
          results.push(filePath);
        }
      }
    });
  }
  traverseDirectory(dir);
  return results;
}
