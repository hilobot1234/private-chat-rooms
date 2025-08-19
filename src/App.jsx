/*
README + Quick setup (all-in-one file: App.jsx)

This single-file React app (default export) is a ready-to-run chat front-end that uses
Firebase Realtime Database for real-time messaging. Room membership is by code: any users
who enter the same code join the same room and exchange messages in real time.

Features
- Enter a room code to create or join a private room
- Real-time messaging via Firebase Realtime Database
- Anonymous auth (Firebase) so you have a simple identity
- Tailwind-based UI (minimal, customizable)

Security notes
- This client app alone cannot guarantee perfect privacy. Configure Firebase rules
  to require authentication for read/write and limit writes to the expected paths.
- Example security rules are included below.

How to use (quick)
1) Create a new Vite React + Tailwind project (or any React setup).
   npx create-vite@latest my-chat --template react
   cd my-chat
   npm install

2) Install Firebase
   npm install firebase

3) Install and configure Tailwind (if you used Vite template, follow Tailwind docs).

4) Replace the default App.jsx with this file's code (or paste the component into src/App.jsx)

5) Create a Firebase project at https://console.firebase.google.com
   - Enable **Realtime Database** and create a database (start in locked mode, then add rules below)
   - Enable **Authentication** -> Sign-in method -> **Anonymous**
   - In Project Settings -> Web apps -> Register app -> copy config
   - Add your Firebase config to a .env file (Vite uses VITE_ prefix):
       VITE_FIREBASE_API_KEY=...
       VITE_FIREBASE_AUTH_DOMAIN=...
       VITE_FIREBASE_DATABASE_URL=...
       VITE_FIREBASE_PROJECT_ID=...
       VITE_FIREBASE_STORAGE_BUCKET=...
       VITE_FIREBASE_MESSAGING_SENDER_ID=...
       VITE_FIREBASE_APP_ID=...

   (Or paste config directly in the code for quick testing — not recommended for public repos.)

6) Example Realtime Database rules (start here and adjust for your needs):
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}

This restricts read/write to authenticated users (we use anonymous auth). Add validation
rules if you want to restrict keys / message shape.

7) Run locally:
   npm run dev

8) Deploy to GitHub
 - Create a GitHub repository and push the project.
 - You can use GitHub Pages, or GitHub Actions to build and publish. For simple static sites
   built with Vite, use the gh-pages package or GitHub Actions workflow that builds and pushes
   to gh-pages branch or to GitHub Pages from the build output.

Commands (example using gh-pages):
   npm run build
   npm install --save-dev gh-pages
   npx gh-pages --dist dist

Or set up an Actions workflow: build on push to main and deploy the dist to gh-pages branch.

--------------------------------------------------------------------------------
App.jsx (paste into src/App.jsx)
--------------------------------------------------------------------------------
*/

import React, { useEffect, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  push,
  onChildAdded,
  query,
  limitToLast,
  off,
  serverTimestamp,
  set,
} from "firebase/database";
import { getAuth, signInAnonymously } from "firebase/auth";

// Firebase config read from Vite env variables. Replace or set these in .env.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// initialize firebase app once
let firebaseApp;
try {
  firebaseApp = initializeApp(firebaseConfig);
} catch (e) {
  // If reloading in dev causes multiple initializations, we ignore the error.
}

const db = getDatabase(firebaseApp);
const auth = getAuth(firebaseApp);

// Utility: random username
function randomName() {
  const adj = ["Bright", "Quick", "Calm", "Lucky", "Brave", "Bold", "Kind"];
  const noun = ["Fox", "Otter", "Raven", "Wolf", "Hawk", "Panda", "Seal"];
  return `${adj[Math.floor(Math.random() * adj.length)]}${noun[Math.floor(Math.random() * noun.length)]}${Math.floor(Math.random() * 900) + 100}`;
}

export default function App() {
  const [stage, setStage] = useState("enter"); // 'enter' | 'chat'
  const [roomCode, setRoomCode] = useState("");
  const [joinedRoom, setJoinedRoom] = useState("");
  const [username, setUsername] = useState(() => randomName());
  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const messagesRefRef = useRef(null);
  const messagesListRef = useRef(null);
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    // Sign in anonymously once when app loads
    signInAnonymously(auth)
      .then(() => setStatus("connected"))
      .catch((err) => {
        console.error("Auth error", err);
        setStatus("auth-failed");
      });

    return () => {
      // cleanup: detach listeners
      if (messagesRefRef.current) {
        off(messagesRefRef.current);
        messagesRefRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    // scroll on messages change
    if (messagesListRef.current) {
      messagesListRef.current.scrollTop = messagesListRef.current.scrollHeight;
    }
  }, [messages]);

  function joinRoom(code) {
    if (!code || !code.trim()) return;
    const normalized = code.trim();
    setJoinedRoom(normalized);
    setStage("chat");
    setMessages([]);

    // Setup listener
    const r = ref(db, `rooms/${normalized}/messages`);
    messagesRefRef.current = r;
    const q = query(r, limitToLast(200));

    onChildAdded(q, (snap) => {
      const val = snap.val();
      setMessages((prev) => [...prev, { id: snap.key, ...val }]);
    });

    // Optionally create a room meta node if you want
    const metaRef = ref(db, `rooms/${normalized}/meta`);
    set(metaRef, { createdAt: serverTimestamp() }).catch(() => {});
  }

  function leaveRoom() {
    if (messagesRefRef.current) {
      off(messagesRefRef.current);
      messagesRefRef.current = null;
    }
    setJoinedRoom("");
    setStage("enter");
    setMessages([]);
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!messageText.trim() || !joinedRoom) return;
    const r = ref(db, `rooms/${joinedRoom}/messages`);
    try {
      await push(r, {
        username,
        text: messageText.trim(),
        ts: Date.now(),
      });
      setMessageText("");
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-3xl bg-white rounded-2xl shadow-lg p-6 grid grid-rows-[auto_1fr] gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Private Chat Rooms</h1>
            <p className="text-sm text-slate-500">Enter a code to create / join a private room. Only people who know the code can join.</p>
          </div>
          <div className="text-sm text-slate-600">
            Status: <span className="font-medium">{status}</span>
          </div>
        </header>

        {stage === "enter" && (
          <div className="space-y-4">
            <label className="block">
              <span className="text-sm font-medium">Your display name</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2" />
            </label>

            <label className="block">
              <span className="text-sm font-medium">Room code</span>
              <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} placeholder="e.g. blue-plant-42 or 6-digit code" className="mt-1 block w-full rounded-lg border px-3 py-2" />
            </label>

            <div className="flex gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-slate-800 text-white hover:opacity-90"
                onClick={() => joinRoom(roomCode)}
              >
                Join / Create Room
              </button>

              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => {
                  // quick way to generate a random code
                  const random = `${Math.random().toString(36).slice(2, 8)}`;
                  setRoomCode(random);
                }}
              >
                Generate Code
              </button>

              <button
                className="px-4 py-2 rounded-lg border"
                onClick={() => {
                  setUsername(randomName());
                }}
              >
                Random Name
              </button>
            </div>

            <div className="text-xs text-slate-500">Tip: share the exact room code with friends. The room will persist until you delete it from the database.</div>
          </div>
        )}

        {stage === "chat" && (
          <div className="h-[60vh] grid grid-rows-[auto_1fr_auto] gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium">Room: {joinedRoom}</div>
                <div className="text-sm text-slate-500">You: <span className="font-medium">{username}</span></div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1 border rounded" onClick={leaveRoom}>Leave</button>
              </div>
            </div>

            <div ref={messagesListRef} className="overflow-auto rounded-lg border p-3 bg-white">
              {messages.length === 0 && <div className="text-sm text-slate-400">No messages yet — say hi 👋</div>}
              <ul className="space-y-3">
                {messages.map((m) => (
                  <li key={m.id} className={`p-2 rounded-md ${m.username === username ? 'bg-sky-50 self-end' : 'bg-slate-50'}`}>
                    <div className="text-xs text-slate-500">{m.username} • {new Date(m.ts).toLocaleTimeString()}</div>
                    <div className="mt-1 text-sm">{m.text}</div>
                  </li>
                ))}
              </ul>
            </div>

            <form onSubmit={sendMessage} className="flex gap-3">
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-lg border px-3 py-2"
              />
              <button type="submit" className="px-4 py-2 rounded-lg bg-slate-800 text-white">Send</button>
            </form>
          </div>
        )}
      </div>

      <footer className="fixed bottom-4 left-4 text-xs text-slate-500">Built with ❤️ — paste your Firebase config into .env and run locally.</footer>
    </div>
  );
}

/*
Optional: Example minimal Realtime Database rule (paste in the Rules tab of Realtime DB):
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null",
        "messages": {
          "$msgId": {
            ".validate": "newData.hasChildren(['username','text','ts']) && newData.child('text').isString() && newData.child('username').isString()"
          }
        }
      }
    }
  }
}

You should tailor rules to your privacy/security requirements.

If you'd like, I can also generate a full repo structure + GitHub Actions workflow for automatic deploy to GitHub Pages. Just tell me if you want "gh-pages" approach or "actions" approach.
*/

