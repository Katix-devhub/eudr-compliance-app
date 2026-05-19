# Security Specification - Traverdy EUDR Compliance

## 1. Data Invariants
- **Auth Bind**: All `Supplier` documents MUST be tied to a `userId` via the `userId` field.
- **Access Control**: Users can only see and modify documents where `userId == request.auth.uid`.
- **Immutability**: `userId`, `ref`, and `createdAt` must be immutable once created.
- **Type Integrity**: Fields like `status`, `risk`, and `type` must strictly follow enums.
- **Size Limits**: String fields must be <= 500 characters, IDs and Ref <= 128 characters.
- **Temporal Order**: `updatedAt` and `createdAt` must use `request.time`.

## 2. Dirty Dozen Payloads (Target: DENY)

1. **Identity Theft**: Create supplier with `userId: "NOT_ME"`.
2. **Global Scraping**: `list` request without `where("userId", "==", auth.uid)`.
3. **Ghost Fields**: Create document with `metadata: { corrupted_data: "..." }` (shadow fields).
4. **State Escalation**: Transition `status` from `new` to `ok` without a valid `lat/lng`.
5. **PII Leak**: Random user tries to `get` a specific supplier by ID they don't own.
6. **Denial of Wallet**: Inject 1MB string into `name` field.
7. **Temporal Fraud**: Update `updatedAt` to `timestamp("2000-01-01T00:00:00Z")`.
8. **Privilege Escalation**: Update/Create with `role: "admin"` (non-blueprint field).
9. **Relational Break**: Delete a supplier that has associated (future) active audits.
10. **ID Poisoning**: Use a document ID containing special injection characters or 2KB size.
11. **Shadow Update**: `update` whitelisted `lat` field but also sneak in an update to `userId`.
12. **Verification Spoof**: `signIn` but with `email_verified: false` and trying to perform writes.

## 3. Test Runner Definition
(Implemented in firestore.rules.test.ts)
