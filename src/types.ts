import type { Timestamp } from 'firebase/firestore';

export interface CommunityEvent {
  id: string;
  title: string;
  location: string;
  startsAt: Timestamp;
  capacity: number;
  taken: number;
}

export interface Rsvp {
  name: string;
  createdAt: Timestamp;
}
