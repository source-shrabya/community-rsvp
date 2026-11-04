import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  type Firestore,
} from 'firebase/firestore';
import type { CommunityEvent } from './types';

export class RsvpError extends Error {}

export function watchEvents(db: Firestore, onChange: (events: CommunityEvent[]) => void) {
  const q = query(collection(db, 'events'), orderBy('startsAt'));
  return onSnapshot(q, (snap) => {
    onChange(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityEvent, 'id'>) })));
  });
}

export function watchMyRsvp(db: Firestore, eventId: string, uid: string, onChange: (going: boolean) => void) {
  return onSnapshot(doc(db, 'events', eventId, 'rsvps', uid), (snap) => onChange(snap.exists()));
}

/**
 * Claims one spot. The RSVP and the counter change in one transaction,
 * and the security rules reject any write where the two disagree, so
 * the count stays right even if two people take the last spot at once.
 */
export async function claimSpot(db: Firestore, eventId: string, uid: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new RsvpError('Enter your name first.');
  if (trimmed.length > 60) throw new RsvpError('Name must be 60 characters or fewer.');

  const eventRef = doc(db, 'events', eventId);
  const rsvpRef = doc(db, 'events', eventId, 'rsvps', uid);

  await runTransaction(db, async (tx) => {
    const [eventSnap, rsvpSnap] = await Promise.all([tx.get(eventRef), tx.get(rsvpRef)]);
    if (!eventSnap.exists()) throw new RsvpError('This event no longer exists.');
    if (rsvpSnap.exists()) throw new RsvpError('You already have a spot.');

    const { taken, capacity } = eventSnap.data() as CommunityEvent;
    if (taken >= capacity) throw new RsvpError('This event is full.');

    tx.set(rsvpRef, { name: trimmed, createdAt: serverTimestamp() });
    tx.update(eventRef, { taken: taken + 1 });
  });
}

export async function releaseSpot(db: Firestore, eventId: string, uid: string) {
  const eventRef = doc(db, 'events', eventId);
  const rsvpRef = doc(db, 'events', eventId, 'rsvps', uid);

  await runTransaction(db, async (tx) => {
    const [eventSnap, rsvpSnap] = await Promise.all([tx.get(eventRef), tx.get(rsvpRef)]);
    if (!eventSnap.exists() || !rsvpSnap.exists()) return;
    tx.delete(rsvpRef);
    tx.update(eventRef, { taken: (eventSnap.data() as CommunityEvent).taken - 1 });
  });
}
