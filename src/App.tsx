import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth';
import { auth, db } from './firebase';
import { watchEvents } from './rsvp';
import type { CommunityEvent } from './types';
import { EventCard } from './EventCard';

export function App() {
  const [user, setUser] = useState<User | null>(null);
  const [events, setEvents] = useState<CommunityEvent[] | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const stop = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else void signInAnonymously(auth);
    });
    return stop;
  }, []);

  useEffect(() => {
    if (!user) return;
    return watchEvents(db, setEvents);
  }, [user]);

  return (
    <main>
      <header>
        <h1>Community events</h1>
        <p>Free health screenings and workshops. Claim a spot so we know how many people to plan for.</p>
      </header>

      <label className="name">
        Your name
        <input
          value={name}
          maxLength={60}
          autoComplete="name"
          onChange={(e) => setName(e.target.value)}
          placeholder="First and last name"
        />
      </label>

      {!user || events === null ? (
        <p className="muted">Loading…</p>
      ) : events.length === 0 ? (
        <p className="muted">No events yet.</p>
      ) : (
        <ul className="events">
          {events.map((ev) => (
            <EventCard key={ev.id} event={ev} uid={user.uid} name={name} />
          ))}
        </ul>
      )}
    </main>
  );
}
