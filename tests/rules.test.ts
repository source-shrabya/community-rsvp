import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { Timestamp, doc, getDoc, serverTimestamp, setDoc, setLogLevel, writeBatch } from 'firebase/firestore';

// Denied writes are the point of most of these tests; keep the log quiet.
setLogLevel('silent');

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-community-rsvp',
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
  });
});

afterAll(() => env.cleanup());

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'events', 'e1'), {
      title: 'Screening',
      location: 'Room 2',
      startsAt: Timestamp.now(),
      capacity: 2,
      taken: 0,
    });
  });
});

const asUser = (uid: string) => env.authenticatedContext(uid).firestore();

function claim(uid: string, taken: number, name = 'Test Person') {
  const db = asUser(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, 'events/e1/rsvps', uid), { name, createdAt: serverTimestamp() });
  batch.update(doc(db, 'events/e1'), { taken });
  return batch.commit();
}

describe('reading', () => {
  it('lets signed-in users read events', async () => {
    await assertSucceeds(getDoc(doc(asUser('alice'), 'events/e1')));
  });

  it('blocks signed-out users', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'events/e1')));
  });

  it("hides other people's RSVPs", async () => {
    await claim('alice', 1);
    await assertFails(getDoc(doc(asUser('bob'), 'events/e1/rsvps/alice')));
  });
});

describe('claiming a spot', () => {
  it('works when the RSVP and counter move together', async () => {
    await assertSucceeds(claim('alice', 1));
  });

  it('rejects an RSVP without the counter', async () => {
    const db = asUser('alice');
    await assertFails(setDoc(doc(db, 'events/e1/rsvps/alice'), { name: 'Alice', createdAt: serverTimestamp() }));
  });

  it('rejects bumping the counter without an RSVP', async () => {
    const db = asUser('alice');
    await assertFails(setDoc(doc(db, 'events/e1'), { taken: 1 }, { merge: true }));
  });

  it('rejects skipping the counter ahead', async () => {
    await assertFails(claim('alice', 2));
  });

  it('rejects an RSVP filed under someone else', async () => {
    const db = asUser('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'events/e1/rsvps/bob'), { name: 'Bob', createdAt: serverTimestamp() });
    batch.update(doc(db, 'events/e1'), { taken: 1 });
    await assertFails(batch.commit());
  });

  it('rejects a second spot for the same person', async () => {
    await claim('alice', 1);
    await assertFails(claim('alice', 2));
  });

  it('stops at capacity', async () => {
    await claim('alice', 1);
    await claim('bob', 2);
    await assertFails(claim('carol', 3));
  });

  it('rejects empty and overlong names', async () => {
    await assertFails(claim('alice', 1, ''));
    await assertFails(claim('alice', 1, 'x'.repeat(61)));
  });

  it('rejects changes to other event fields', async () => {
    const db = asUser('alice');
    const batch = writeBatch(db);
    batch.set(doc(db, 'events/e1/rsvps/alice'), { name: 'Alice', createdAt: serverTimestamp() });
    batch.update(doc(db, 'events/e1'), { taken: 1, capacity: 100 });
    await assertFails(batch.commit());
  });
});

describe('cancelling', () => {
  it('frees the spot when the RSVP and counter move together', async () => {
    await claim('alice', 1);
    const db = asUser('alice');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events/e1/rsvps/alice'));
    batch.update(doc(db, 'events/e1'), { taken: 0 });
    await assertSucceeds(batch.commit());
  });

  it("rejects cancelling someone else's spot", async () => {
    await claim('alice', 1);
    const db = asUser('bob');
    const batch = writeBatch(db);
    batch.delete(doc(db, 'events/e1/rsvps/alice'));
    batch.update(doc(db, 'events/e1'), { taken: 0 });
    await assertFails(batch.commit());
  });
});
