# Community RSVP

An RSVP board for free community health events, such as a blood pressure screening or a CPR class. People open the page, enter their name and claim a spot. When an event fills up, the button turns off.

Built with React, TypeScript, Vite, Firebase Auth and Cloud Firestore.

## How the spot count stays right

Each event has a `capacity` and a `taken` counter. Each RSVP is stored at `events/{eventId}/rsvps/{uid}`, so one person can hold at most one spot per event.

The client claims a spot in a Firestore transaction that writes the RSVP and adds one to `taken` together. The client check alone is not enough, because anyone can call Firestore directly with the same config. So `firestore.rules` checks every write on the server:

- `taken` can only go up by one, and only in the same write that creates the caller's own RSVP.
- `taken` can only go down by one, and only in the same write that deletes the caller's own RSVP.
- `taken` can never pass `capacity`.
- No other event field can be changed from the client.
- An RSVP needs a name of 1 to 60 characters and a server timestamp.
- People can read their own RSVP but cannot list who else signed up.

`tests/rules.test.ts` has 14 tests against the Firestore emulator. They cover each of these rules, including someone trying to skip the counter ahead, take a second spot, or cancel another person's spot.

## Run it locally

You need Node 22.6 or newer and Java 11 or newer (for the Firebase emulators). No Firebase account is needed.

```sh
npm install
npm run emulators      # terminal 1: Auth and Firestore emulators
npm run seed           # terminal 2: adds three sample events
npm run dev            # terminal 2: app at http://localhost:5173
```

Run the rules tests (this starts and stops the emulator by itself):

```sh
npm test
```

## Use a real Firebase project

1. Create a project in the Firebase console and turn on Anonymous sign-in and Cloud Firestore.
2. Copy `.env.example` to `.env.local` and fill in the web app config.
3. Deploy the rules and the site with `npx firebase deploy --project <your-project-id>`.

Events are added by staff from the Firebase console. The rules block clients from creating or deleting them.

## Layout

```
src/firebase.ts     app setup; uses the emulators when no project is configured
src/rsvp.ts         claim and cancel transactions, live listeners
src/App.tsx         sign-in and event list
src/EventCard.tsx   one event with its claim or cancel button
firestore.rules     server-side checks
tests/              rules tests
scripts/seed.ts     sample events for the emulator
```

## License

MIT. See `LICENSE`.
