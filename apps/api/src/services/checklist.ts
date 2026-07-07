export type ChecklistItemResponse = {
  itemKey: string;
  isChecked: boolean;
  updatedAt: string;
};

type ChecklistRow = {
  id: string;
  householdId: string;
  userId: string;
  category: string;
  itemKey: string;
  isChecked: boolean;
  updatedAt: Date;
};

function storeKey(householdId: string, category: string, itemKey: string): string {
  return `${householdId}\0${category}\0${itemKey}`;
}

export function toChecklistItemResponse(row: {
  itemKey: string;
  isChecked: boolean;
  updatedAt: Date;
}): ChecklistItemResponse {
  return {
    itemKey: row.itemKey,
    isChecked: row.isChecked,
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** In-memory store — mirror kontrak DB untuk unit test tanpa Postgres. */
export class InMemoryChecklistStore {
  private rows = new Map<string, ChecklistRow>();

  list(householdId: string, category: string): ChecklistItemResponse[] {
    return [...this.rows.values()]
      .filter((row) => row.householdId === householdId && row.category === category)
      .map(toChecklistItemResponse);
  }

  upsert(
    householdId: string,
    userId: string,
    category: string,
    itemKey: string,
    checked: boolean,
  ): ChecklistItemResponse {
    const key = storeKey(householdId, category, itemKey);
    const existing = this.rows.get(key);
    const now = new Date();

    if (existing) {
      existing.isChecked = checked;
      existing.userId = userId;
      existing.updatedAt = now;
      return toChecklistItemResponse(existing);
    }

    const row: ChecklistRow = {
      id: crypto.randomUUID(),
      householdId,
      userId,
      category,
      itemKey,
      isChecked: checked,
      updatedAt: now,
    };
    this.rows.set(key, row);
    return toChecklistItemResponse(row);
  }

  /** Helper test: hitung baris untuk kombinasi unik (household, category, itemKey). */
  countUnique(householdId: string, category: string, itemKey: string): number {
    const key = storeKey(householdId, category, itemKey);
    return this.rows.has(key) ? 1 : 0;
  }
}
