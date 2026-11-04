import { useEffect, useState } from 'react';
import { db } from './firebase';
import { RsvpError, claimSpot, releaseSpot, watchMyRsvp } from './rsvp';
import type { CommunityEvent } from './types';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

interface Props {
  event: CommunityEvent;
  uid: string;
  name: string;
}

export function EventCard({ event, uid, name }: Props) {
  const [going, setGoing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchMyRsvp(db, event.id, uid, setGoing), [event.id, uid]);

  const left = event.capacity - event.taken;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof RsvpError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="event">
      <div>
        <h2>{event.title}</h2>
        <p className="muted">
          {dateFormat.format(event.startsAt.toDate())} · {event.location}
        </p>
        <p className={left === 0 ? 'full' : undefined}>
          {left === 0 ? 'Full' : `${left} of ${event.capacity} spots left`}
        </p>
        {error && <p className="error" role="alert">{error}</p>}
      </div>
      {going ? (
        <button disabled={busy} onClick={() => run(() => releaseSpot(db, event.id, uid))}>
          Cancel my spot
        </button>
      ) : (
        <button
          className="primary"
          disabled={busy || left === 0}
          onClick={() => run(() => claimSpot(db, event.id, uid, name))}
        >
          Claim a spot
        </button>
      )}
    </li>
  );
}
