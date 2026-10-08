# @invisibledb/react-native

First-class InvisibleDB SDK for React Native. It is not the web SDK re-exported under a mobile package name.

Mobile-specific behavior included:

- client-safe user authentication plus server-side API-key mode
- pluggable durable token storage (wire to Keychain/Keystore in production)
- request timeout and bounded retry/backoff for 429/5xx/network failures
- typed CRUD, filters, sorting, expand, vectors, health and file URLs
- multipart record/file create and update using React Native `FormData`
- lifecycle-aware realtime reconnect through an injected React Native `AppState` adapter
- injected EventSource factory so apps can use the SSE implementation they already ship

```ts
import { AppState } from 'react-native';
import { InvisibleDB } from '@invisibledb/react-native';

const db = new InvisibleDB({
  baseUrl: 'https://acme.invisibledb.app',
  appState: AppState,
  tokenStore: secureTokenStore,
  eventSourceFactory,
});

await db.restoreSession();
await db.auth.withPassword('users', email, password);
const messages = await db.collection('messages').getList({ sort: '-created' });
```

Do not embed an InvisibleDB instance API key in a consumer mobile app. Use collection user auth and collection API rules.
