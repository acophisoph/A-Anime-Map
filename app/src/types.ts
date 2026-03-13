export type Mode = 'media' | 'people';

export interface Manifest {
  total_media_in_db: number;
  total_people_in_db: number;
  completed_batches_count: number;
  pending_batches_count: number;
  last_ingest_run_timestamp: number;
  has_staff_for_all_media: boolean;
  has_characters_for_all_media: boolean;
  artifact_encoding?: 'json';
}

export interface Point {
  id: number;
  kind: 0 | 1;
  x: number;
  y: number;
}

export interface SearchEntry {
  id: number;
  kind: 'media' | 'person';
  label_en: string;
  label_native: string;
  year?: number;
  tags?: string[];
}
