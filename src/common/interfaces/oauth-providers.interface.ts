export interface GoogleProfile {
  id: string;
  displayName: string;
  emails?: { value: string; verified?: boolean }[];
  photos?: { value: string }[];
  provider: 'google';
}

export interface GithubProfile {
  id: string | number;
  displayName: string;
  username: string;
  profileUrl?: string;
  photos?: { value: string }[];
  provider: 'github';
}
