/**
 * PracticeListService — user-created practice lists.
 *
 * A practice list is a named, PER-LANGUAGE set of words the learner saved from
 * "Your words" to drill later (via the home "Practice" card). Lists live in the
 * `practiceLists` IndexedDB table and are scoped to the learning language they
 * were created in, so French lists don't show up while learning Dutch.
 *
 * @module app/services
 */
import { Injectable, signal } from '@angular/core';
import { getDatabase, type PracticeListEntity } from '../../persistence/database';

export interface PracticeList {
  id: string;
  languageCode: string;
  name: string;
  words: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class PracticeListService {
  private db = getDatabase();

  /** All lists, reactive. Refreshed on every mutation. */
  readonly lists = signal<PracticeList[]>([]);

  private loaded = false;

  /** Load all lists once (idempotent). */
  async init(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    const rows = await this.db.practiceLists.toArray();
    rows.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    this.lists.set(rows.map(r => ({ ...r })));
  }

  /** Lists for a specific learning language (newest first). */
  listsFor(languageCode: string): PracticeList[] {
    return this.lists().filter(l => l.languageCode === languageCode);
  }

  /** Create a new list (or merge into an existing one with the same name). */
  async createList(languageCode: string, name: string, words: string[]): Promise<PracticeList> {
    const trimmed = name.trim() || 'My list';
    const unique = [...new Set(words.map(w => w.trim()).filter(Boolean))];
    const now = new Date().toISOString();

    // If a list with this name already exists for the language, merge words in.
    const existing = (await this.db.practiceLists.toArray())
      .find(l => l.languageCode === languageCode && l.name.toLowerCase() === trimmed.toLowerCase());

    if (existing) {
      const merged = [...new Set([...existing.words, ...unique])];
      const updated: PracticeListEntity = { ...existing, words: merged, updatedAt: now };
      await this.db.practiceLists.put(updated);
      await this.refresh();
      return { ...updated };
    }

    const entity: PracticeListEntity = {
      id: `plist-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      languageCode, name: trimmed, words: unique, createdAt: now, updatedAt: now,
    };
    await this.db.practiceLists.put(entity);
    await this.refresh();
    return { ...entity };
  }

  /** Rename a list. */
  async renameList(id: string, name: string): Promise<void> {
    const row = await this.db.practiceLists.get(id);
    if (!row) return;
    row.name = name.trim() || row.name;
    row.updatedAt = new Date().toISOString();
    await this.db.practiceLists.put(row);
    await this.refresh();
  }

  /** Delete a list. */
  async deleteList(id: string): Promise<void> {
    await this.db.practiceLists.delete(id);
    await this.refresh();
  }

  /** Get a single list by id. */
  async getList(id: string): Promise<PracticeList | null> {
    const row = await this.db.practiceLists.get(id);
    return row ? { ...row } : null;
  }
}
