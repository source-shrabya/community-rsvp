// Adds sample events to the local Firestore emulator.
// Run with the emulators already up: npm run seed
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { Timestamp, doc, setDoc } from 'firebase/firestore';

const day = 24 * 60 * 60 * 1000;
const at = (daysFromNow: number, hour: number) => {
  const d = new Date(Date.now() + daysFromNow * day);
  d.setHours(hour, 0, 0, 0);
  return Timestamp.fromDate(d);
};

const events = [
  { id: 'bp-screening', title: 'Blood pressure screening', location: 'Community center, room 2', startsAt: at(3, 10), capacity: 25 },
  { id: 'diabetes-101', title: 'Living with type 2 diabetes', location: 'Public library, meeting room', startsAt: at(6, 18), capacity: 15 },
  { id: 'cpr-basics', title: 'Hands-only CPR basics', location: 'Fire station 4', startsAt: at(10, 14), capacity: 3 },
];

const env = await initializeTestEnvironment({
  projectId: 'demo-community-rsvp',
  firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') },
});

await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const { id, ...data } of events) {
    await setDoc(doc(db, 'events', id), { ...data, taken: 0 });
  }
});

await env.cleanup();
console.log(`Seeded ${events.length} events.`);
