export interface TrelloCardLabel {
  id: string;
  name?: string;
  color?: string;
}

export interface CardMetadata {
  id: string;
  shortLink?: string;
  labels?: TrelloCardLabel[];
}
