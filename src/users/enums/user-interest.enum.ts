export enum UserInterest {
  NEWS = 'News',
  SPORTS = 'Sports',
  MUSIC = 'Music',
  DANCE = 'Dance',
  CELEBRITY = 'Celebrity',
  RELATIONSHIPS = 'Relationships',
  MOVIES_TV = 'Movies & TV',
  TECHNOLOGY = 'Technology',
  BUSINESS_FINANCE = 'Business & Finance',
  GAMING = 'Gaming',
  FASHION = 'Fashion',
  FOOD = 'Food',
  TRAVEL = 'Travel',
  FITNESS = 'Fitness',
  SCIENCE = 'Science',
  ART = 'Art',
}

// Helper to get all interest values
export const ALL_INTERESTS = Object.values(UserInterest);

// Helper to get interest key from value
export function getInterestKey(value: string): string | undefined {
  return Object.keys(UserInterest).find(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
    (key) => UserInterest[key as keyof typeof UserInterest] === value,
  );
}

// Helper to convert slug to enum value
export const INTEREST_SLUG_TO_ENUM: Record<string, UserInterest> = {
  news: UserInterest.NEWS,
  sports: UserInterest.SPORTS,
  music: UserInterest.MUSIC,
  dance: UserInterest.DANCE,
  celebrity: UserInterest.CELEBRITY,
  relationships: UserInterest.RELATIONSHIPS,
  'movies-tv': UserInterest.MOVIES_TV,
  technology: UserInterest.TECHNOLOGY,
  'business-finance': UserInterest.BUSINESS_FINANCE,
  gaming: UserInterest.GAMING,
  fashion: UserInterest.FASHION,
  food: UserInterest.FOOD,
  travel: UserInterest.TRAVEL,
  fitness: UserInterest.FITNESS,
  science: UserInterest.SCIENCE,
  art: UserInterest.ART,
};

// Helper to convert enum to slug
export const INTEREST_ENUM_TO_SLUG: Record<UserInterest, string> = {
  [UserInterest.NEWS]: 'news',
  [UserInterest.SPORTS]: 'sports',
  [UserInterest.MUSIC]: 'music',
  [UserInterest.DANCE]: 'dance',
  [UserInterest.CELEBRITY]: 'celebrity',
  [UserInterest.RELATIONSHIPS]: 'relationships',
  [UserInterest.MOVIES_TV]: 'movies-tv',
  [UserInterest.TECHNOLOGY]: 'technology',
  [UserInterest.BUSINESS_FINANCE]: 'business-finance',
  [UserInterest.GAMING]: 'gaming',
  [UserInterest.FASHION]: 'fashion',
  [UserInterest.FOOD]: 'food',
  [UserInterest.TRAVEL]: 'travel',
  [UserInterest.FITNESS]: 'fitness',
  [UserInterest.SCIENCE]: 'science',
  [UserInterest.ART]: 'art',
};
