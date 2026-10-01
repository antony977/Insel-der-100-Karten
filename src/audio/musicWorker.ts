import { renderSong } from './composer';
import { SONGS } from './songs';

/**
 * Rendert Musikstücke im Hintergrund, damit das Spiel beim Regionswechsel nicht ruckelt.
 */
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<string>) => void) | null;
  postMessage(msg: unknown, transfer: Transferable[]): void;
};

ctx.onmessage = (e) => {
  const id = e.data;
  const spec = SONGS[id];
  if (!spec) return;
  const buf = renderSong(spec);
  ctx.postMessage({ id, buf }, [buf.buffer]);
};
