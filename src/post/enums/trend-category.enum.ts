export enum TrendCategory {
  GENERAL = 'general',
  NEWS = 'news',
  SPORTS = 'sports',
  ENTERTAINMENT = 'entertainment',
}

export const CATEGORY_TO_INTERESTS: Record<TrendCategory, string[]> = {
  [TrendCategory.GENERAL]: [],
  [TrendCategory.NEWS]: ['news'],
  [TrendCategory.SPORTS]: ['sports'],
  [TrendCategory.ENTERTAINMENT]: ['music', 'dance', 'celebrity', 'movies-tv', 'gaming', 'art'],
};

// Helper to get all category values
export const ALL_TREND_CATEGORIES = Object.values(TrendCategory);

// Helper to validate category
export function isValidTrendCategory(value: string): value is TrendCategory {
  return ALL_TREND_CATEGORIES.includes(value as TrendCategory);
}
