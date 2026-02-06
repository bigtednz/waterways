/**
 * Build version string for display (injected at build time by Vite).
 * Updates automatically with each build (time + git SHA).
 */
export function getBuildVersion(): string {
  const time = typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : "";
  const sha = typeof __GIT_SHA__ !== "undefined" ? __GIT_SHA__ : "dev";
  if (!time) return `Build ${sha}`;
  const date = new Date(time);
  const dateStr = date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const timeStr = date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Build ${dateStr} ${timeStr} · ${sha}`;
}
