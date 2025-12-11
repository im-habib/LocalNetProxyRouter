import chokidar from "chokidar";

export function watchReload(paths: string[], onChange: () => void) {
  const watcher = chokidar.watch(paths);
  watcher.on("change", () => {
    console.log("Files changed, reloading...");
    onChange();
  });
}
