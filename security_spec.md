# Security Specification: PLN ULP Baguala GIS & Synchronization

## 1. Data Invariants
1. Poles must have valid alphanumeric IDs, valid coordinates (latitude/longitude), and designated feeder lines.
2. Cable spans must define valid source and target pole references (`fromPoleId` and `toPoleId`), positive span length, and bounded string sizes.
3. Maintenance work orders (SPKs) must link to a target pole ID and contain a non-empty SPK number.
4. User accounts must maintain valid PLN employee user IDs, designated role types, and active status indicators.
5. All document modifications must respect maximum boundary sizes to prevent resource exhaustion attacks.
6. The deletion ledger in `app_state` must only be modified with validated array bounds.

## 2. The "Dirty Dozen" Payloads (Targeting Vulnerabilities)
1. **Payload 1 (ID Poisoning - Pole):** Pole with 2KB string ID containing special characters `../../root`. Expectation: REJECT.
2. **Payload 2 (Ghost Field Attack - Pole):** Updating pole with unapproved shadow property `__secretAdmin: true`. Expectation: REJECT.
3. **Payload 3 (Coordinates NaN/Infinity):** Pole with latitude `9999` or non-numeric type. Expectation: REJECT.
4. **Payload 4 (Orphan Span):** Span without `fromPoleId` or `toPoleId`. Expectation: REJECT.
5. **Payload 5 (Oversized Span Notes):** Cable span with 50,000 character notes string. Expectation: REJECT.
6. **Payload 6 (Invalid Pole Voltage Type):** Pole type set to `INVALID_400KV`. Expectation: REJECT.
7. **Payload 7 (Negative Clearance):** Clearance set to negative distance value `-50.0m`. Expectation: REJECT.
8. **Payload 8 (Invalid SPK Status):** Work order status set to `UNKNOWN_STATUS`. Expectation: REJECT.
9. **Payload 9 (User Role Escalation):** Setting role to `SUPER_ROOT_ADMIN`. Expectation: REJECT.
10. **Payload 10 (Denial-of-Wallet Array Injection):** Array with 100,000 items in deletion ledger. Expectation: REJECT.
11. **Payload 11 (Unauthenticated Write to Admins):** Direct write to admin privileged collection. Expectation: REJECT.
12. **Payload 12 (Malicious Script in Location):** Location name containing 10KB raw binary payload. Expectation: REJECT.

## 3. Test Runner
Defined in `firestore.rules.test.ts` ensuring all Dirty Dozen tests are blocked and verified.
