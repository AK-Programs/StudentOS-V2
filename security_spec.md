# Security Specification & Threat Model (Zero-Trust ABAC)

This security specification details the threat models, data invariants, and defensive validation rules designed to safeguard the StudentOS ledger across all six Firestore collections.

## 1. Data Invariants

1. **Task Boundary Ownership**: Students are strictly prohibited from reading, updating, or deleting checklists belonging to other student accounts (`userId == request.auth.uid`).
2. **Notes Vault Isolation**: Vault items contain proprietary learning ideas. Only the author student can create, read, update, or delete their notes (`userId == request.auth.uid`).
3. **Faculty exclusive write operations for Materials Hub**: Academic resources inside the Materials Hub can only satisfy upload requests if the creator is an authorized user (registered under administrative or teaching credentials). Standard students are barred from adding public sheets.
4. **Targeted Material Visibility**: Restricted (non-public) folders in the Materials Hub must compile filters strictly matching the logged student's active `grade`, `house`, or `section` profiles.
5. **No Spoofing Roles or Points**: Users are strictly barred from upgrading their profile roles to "teacher" or boosting point tallies unilaterally.
6. **Immutable Records & Time Stamps**: Relational tracking fields like `createdAt` are immortal. Timestamp validation must use the authoritative `request.time`.

---

## 2. The "Dirty Dozen" Threat Payloads

Here are twelve highly targeted JSON payload vectors constructed to stress-test our security schema invariants. Every single one of these must return `PERMISSION_DENIED` at the Firestore Rule Gateway line.

### [Identity Theft & Spoofing Vector]
1. **P1: Cross-User Todo Injection**: Authenticated student Bob attempts to inject a task document where `userId` is set to Alice's profile UID.
2. **P2: Notes Hijacking**: Bob attempts to query or read documents in the `notes` collection where `userId != request.auth.uid`.
3. **P3: Faculty Identity Spoof**: Student Bob attempts to share a global material sheet by passing `uploadedBy: "Prof. Elara"` and naming the owner/subject as generic to bypass role checks.

### [Privilege Escalation Vector]
4. **P4: Roster Diary Unauthorized Pen**: Student Bob attempts to update the attendance registry for `2026-06-09` from "absent" to "present".
5. **P5: Feedbacks Vote Forgery**: Bob attempts to cast 100 votes to their own feed by sending an update payload where `votes` increments from `1` to `100`.
6. **P6: Public Announcement Defacement**: Bob attempts to post or delete critical school-wide notification posts in the `/announcements/` register.

### [Data Corruption & Injection Vector]
7. **P7: Denial-of-Wallet Path Poisoning**: Bob attempts to write a document under `/tasks/SUPER_LONG_20KB_CHAR_STRING_THAT_BLOWS_UP_THE_STORAGE_COST`.
8. **P8: Schema Keys Bypass**: Bob attempts to inject a note document with extra "ghost" fields like `{ isSystemAdministrator: true }` to see if the rules accept non-whitelisted keys.
9. **P9: Non-Enum Status Injection**: Bob attempts to alter a suggestion card status to an unapproved state like `{ status: "deletedByHacker" }` to pollute state machines.

### [Temporal Integrity Vector]
10. **P10: Back-Dated Submissions**: Bob attempts to send a note or material sheet with a fake customized `createdAt: "1999-01-01T00:00:00Z"` client-side timestamp.
11. **P11: Relational Node Poisoning**: Bob attempts to publish a homework solution where the course subject does not exist or is malformed.
12. **P12: Immutable Key Manipulation**: Bob attempts to update a note's title but updates the note's immutable `createdAt` timestamp to skip history queues.

---

## 3. Test Runner Definition: `firestore.rules.test.ts`

```typescript
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';

describe('StudentOS Security Rules Verification', () => {
  let testEnv: any;

  beforeAll(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'gen-lang-client-0785563242',
      firestore: {
        rules: require('fs').readFileSync('firestore.rules', 'utf8')
      }
    });
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  it('P1: Should block cross-user Task creation', async () => {
    const bobDb = testEnv.authenticatedContext('bob_user').firestore();
    const taskRef = doc(bobDb, 'tasks/bob_task_1');
    await assertFails(setDoc(taskRef, {
      id: 'bob_task_1',
      title: 'Hacked Task',
      completed: false,
      userId: 'alice_user',
      createdAt: '2026-06-09T00:00:00Z'
    }));
  });

  it('P4: Should prevent standard accounts from changing attendance status', async () => {
    const bobDb = testEnv.authenticatedContext('bob_user').firestore();
    const attRef = doc(bobDb, 'attendance/2026-06-09');
    await assertFails(setDoc(attRef, {
      date: '2026-06-09',
      status: 'present'
    }));
  });
});
```
