/**
 * Sichtbarkeitsregeln für Figuren, die nicht nur von Flags abhängen (z. B. Rivalen,
 * die je nach Tageszeit in verschiedenen Städten sind). Regeln werden von Systemen
 * registriert, die Figurendaten bleiben davon unabhängig.
 */
const RULES = new Map<string, () => boolean>();

export function registerNpcRule(name: string, fn: () => boolean): void {
  RULES.set(name, fn);
}

export function npcRule(name: string): boolean {
  const r = RULES.get(name);
  return r ? r() : true;
}
