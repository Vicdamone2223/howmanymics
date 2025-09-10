export type NewsItem = {
  id: string;
  title: string;
  dek?: string;
  // ➜ allow reviews & articles in the slider tag
  tag: 'NEWS' | 'FEATURE' | 'ANNIV' | 'REVIEW' | 'ARTICLE';
  heroImg: string;
  href: string;
};

export type ReleaseItem = {
  id: string;
  cover: string;
  title: string;
  artist: string;
  date: string;
  confidence?: 'confirmed' | 'rumor';
  href: string;
};

export type GoatRow = {
  rank: number;
  artistId: number;
  name: string;
  img: string;
  scoreOverall: number;
  scorePeople?: number;
  rankStaff?: number;
};

export type AlbumYearRow = {
  rank: number;
  cover: string;
  title: string;
  artist: string;
  date: string;          // e.g., "Apr 19"
  href: string;
  // Scores
  scoreOverall?: number; // optional, if you want to pre-calc
  scoreStaff?: number;   // 🎤 staff score
  scorePeople?: number;  // 🔥 people score
};

export type TrendingRow = {
  cover: string;
  title: string;
  artist: string;
  votesDelta: number;
  scoreNow: number;
  href: string;
};

export type TodayEvent = {
  type: 'anniv' | 'birthday' | 'moment';
  text: string;
  href: string;
};

export type Debate = {
  topic: string;
  aLabel: string;
  bLabel: string;
  aPct: number;
  bPct: number;
  href: string;
};

export type ListCard = {
  type: 'staff' | 'fan';
  title: string;
  collageImg: string;
  href: string;
};
