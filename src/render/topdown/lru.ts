/**
 * A bounded least-recently-used map: the top-down layers cache their computed masks in one, so a
 * long session never holds more of them than `cap` (iOS caps canvas memory; CLAUDE.md, the sprite
 * cache rule). A read moves the entry to the back; a write past the cap drops the oldest.
 */
export class BoundedLru<K, V> {
  private readonly entries = new Map<K, V>();

  constructor(readonly cap: number) {}

  get size(): number {
    return this.entries.size;
  }

  get(key: K): V | undefined {
    const value = this.entries.get(key);
    if (value === undefined) return undefined;
    this.entries.delete(key);
    this.entries.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    while (this.entries.size > this.cap) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  has(key: K): boolean {
    return this.entries.has(key);
  }

  delete(key: K): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}
