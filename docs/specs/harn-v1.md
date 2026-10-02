# Harn v1: Receipt Capture, Review, and Bill Splitting

Status: Planned. The app currently contains a Next.js home page.
Specification: [GitHub issue #1](https://github.com/jeffza666/harn/issues/1).
Implementation tasks: [v1 task plan](harn-tasks.md).

## Problem Statement

Typing a receipt and dividing individual purchases is slow and error-prone.
People need to photograph or upload one receipt, check the extracted products,
prices, and taxes, choose who shares each item, and trust the resulting totals.

The existing Vite app is a behavior reference for item assignments, weighted
splitting, charges, currency conversion, history, and summary copying. Harn
currently has only a Next.js home page; the features below are planned.

## Solution

Make AI receipt extraction the primary v1 feature:

Capture or upload one image -> inspect the image -> extract an editable draft
-> review items and charges -> assign participants -> confirm and save
-> view balances and expense summaries.

One signed-in owner manages groups and named participants. Participants do
not need accounts in v1. Reduce collaboration workflows to ship a complete,
explainable portfolio project. Natural-language entry is a later milestone.

## User Stories

1. As a visitor, I want an anonymous demo with fictional data, so that I can try the main workflow immediately.
2. As a visitor, I want demo AI results clearly labelled, so that I know whether extraction is simulated.
3. As an owner, I want Google sign-in, so that my saved bills remain private across sessions.
4. As an owner, I want groups with stable named participants, so that I can track separate households or trips without merging identical names.
5. As an owner, I want to upload a receipt image, so that I can avoid typing every item.
6. As a mobile user, I want to take one photo using my phone camera, so that I can process a receipt immediately.
7. As a user, I want to preview and retake or replace the image before extraction, so that I can choose a readable photograph.
8. As a user, I want extraction of product names, quantities, prices, line totals, and currency, so that I can prepare a bill quickly.
9. As a user, I want VAT, other tax, service charges, and printed totals identified, so that charges are not missed or counted twice.
10. As a user, I want missing or ambiguous fields flagged, so that AI guesses do not silently enter my financial records.
11. As a user, I want to edit, add, and remove extracted items before saving, so that I can correct recognition errors.
12. As a user, I want to compare the calculated and printed receipt totals, so that I can notice discrepancies before confirmation.
13. As a user, I want manual entry when AI fails or quota is exhausted, so that I can still complete the bill.
14. As an owner, I want to select one payer and participants for each item, so that each person is responsible only for their purchases.
15. As an owner, I want equal or group-weighted splitting, so that I can use arrangements such as 50/50 and 60/40.
16. As an owner, I want new group weights to affect new bills only, so that historical debt stays stable.
17. As an owner, I want separate charge allocation choices, so that added tax and service charges can be shared equally or proportionally.
18. As an owner, I want THB and USD bills with recorded conversion rates, so that balances can be summarized in THB.
19. As an owner, I want incomplete drafts saved without affecting balances, so that I can return to unfinished work.
20. As an owner, I want saved bills editable or cancellable, so that I can correct mistakes and recompute balances.
21. As an owner, I want to record partial repayments immediately, so that I can maintain my own record of real transfers.
22. As an owner, I want attached receipt images private, so that financial records are not publicly accessible.
23. As an owner, I want a copyable summary for LINE, so that I can communicate the split.
24. As an owner, I want monthly, category, and participant charts, so that I can understand group spending and a selected participant's responsibility.

## Implementation Decisions

### Ownership and application boundaries

- Use Next.js App Router, TypeScript, Tailwind, shadcn/ui, Prisma, Supabase PostgreSQL/Auth/Storage, Zod, and Recharts.
- One account owns each group. Model users, owned groups, named participants, bills, items, allocations, repayments, and receipt attachments. Add future collaboration models only when needed.
- Google sign-in protects persistence and real AI processing. Every read, write, and attachment request checks ownership on the server; participant names do not grant access.
- Use stable participant IDs, independent of names. Archive participants referenced by bills instead of deleting their identities.
- Separate pure calculation, authenticated application operations, and UI. Validate server inputs with Zod and recompute authoritative totals server-side.

### Receipt capture and extraction

- Accept one still image per extraction. Provide separate upload and take-photo actions, followed by preview and an explicit extract action. Do not process continuous camera frames.
- Start with native mobile camera capture using an image file input requesting the rear camera. Browser support varies; always retain upload fallback. A custom in-page camera view is outside v1.
- Lazy-load browser-image-compression on image selection, normalize orientation, and produce JPEG with a target size of 2 MB and a hard submitted-file limit of 3 MB. Start with a 2560-pixel maximum dimension and check small receipt text remains legible. Show progress and allow replacement/cancellation; check actual output size rather than trusting compression settings.
- Accept JPEG, PNG, and WebP source images up to 20 MB before client preprocessing. Validate decoded content and image bounds on the server, with bounded decoding memory. Remove EXIF metadata from the submitted derivative.
- Compression alone does not guarantee HEIC decoding. If the browser cannot decode the source, show actionable JPEG/export or retake instructions. A dedicated HEIC conversion library is deferred unless actual target-device tests demonstrate it is necessary; never merely rename a HEIC file to JPEG.
- Submit compressed image bytes via multipart FormData to a Route Handler, not base64 JSON. Account for complete multipart request overhead under the current deployment limit. Avoid the separate default Server Action body-size restriction for this upload flow.
- Use Gemini Free Tier with server-only credentials and a currently available Flash-family model supporting vision and structured output. Configure its model ID through GEMINI_MODEL; verify account access, quota, deprecation status, and sample-receipt results when implementing. Do not use obsolete 1.5/2.0 or old preview IDs, and do not select an image-generation model for receipt extraction.
- Request a structured receipt draft and validate it with Zod. The draft carries original labels, item values, explicit unresolved fields, printed subtotal/total, and charge treatment. Provider values never become authoritative money totals without review.
- Item prices must distinguish unit price from line total. When only a line total is readable, propose quantity 1 and visibly explain the assumption. Unit-price discrepancies require correction.
- Tax treatment has included, added, none, or unresolved states. Included VAT is informational and does not increase the bill total. Added charges are counted exactly once. Use the same explicit included/added distinction for service charges where required.
- Do not infer an unreadable charge amount as zero or determine ambiguous tax treatment silently. Let the user resolve missing financial fields manually.
- Compare the reconstructed total with the printed grand total when readable. Block confirmation on a discrepancy until corrected or explicitly acknowledged with a note. Unsupported discount/refund cases require a manual correction and acknowledgement; do not silently omit them.
- Extract currency without guessing unsupported values. The user resolves unknown currency and confirms participants; AI does not assign who purchased an item from a receipt image.
- Show pending, successful, and failed extraction states. Preserve prior drafts on errors and require explicit confirmation before replacing existing items. No automatic database save from provider output.
- Apply per-owner limits, timeout, output bounds, and bounded retries. Free-tier development uses fictional or redacted images, and the upload flow explains provider handling before submission.
- Attach confirmed source images to private storage and serve short-lived authorized URLs. Clean up abandoned uploads. Private storage does not imply private processing by the free-tier provider.

### Splitting, persistence, and balances

- One payer per bill; all selected participants belong to its group. Items use positive unit price times positive integer quantity.
- Each item splits equally or uses captured group weights among its selected participants. Selected weights must sum to a positive value. Use exact minor-unit allocation with deterministic largest-remainder tie handling.
- Store money without binary floating-point calculations and enforce safe numeric bounds. Use Decimal for exchange rates and decimal strings at API boundaries.
- Allocate added tax/service charges equally or in proportion to item responsibility among assigned participants. Included tax is not an additional allocation.
- THB bills use rate 1; USD bills use a manually entered positive USD-to-THB rate and date. Persist that rate and bill weights, including for historical summaries.
- Convert and round the complete total to THB, then allocate responsibility so THB shares sum exactly to it.
- Bill states are DRAFT, CONFIRMED, and CANCELLED. Confirmation requires complete assignments and resolved financial inputs. Only confirmed bills affect expenses and balances.
- Owners can edit or cancel bills. Validate and save related records atomically and reject stale updates. Keep cancellation records, but full revision history/audit logs are deferred.
- Record THB repayments between participants as owner-entered bookkeeping, effective immediately with no recipient approval. Support partial repayment, correction, and cancellation; clearly state this does not verify a bank transfer.
- Net balance is amounts paid minus responsibility plus repayments sent minus repayments received. Recompute from confirmed bills and active repayments. Changes to bills do not erase recorded repayments.
- Copy summaries include payer, individual shares, currency, and recorded conversion data.

### Dashboard and portfolio demo

- Show monthly comparisons, one category per bill, responsibility proportions, and net balances. Group view shows spending; a selected participant view shows responsibility and amounts paid. Do not call an unlinked participant the signed-in user's personal account.
- Use bill dates with Asia/Bangkok month boundaries and persisted THB values. Repayments do not count as new expenses.
- Ship Thai-first responsive UI and an English README. Keep user-facing UI strings, validation messages, and accessibility labels in a typed central labels dictionary with semantic keys, initially in constants/labels.ts. Components use keys instead of scattered literals. A later English dictionary must implement the same key structure; full language switching is deferred. Keep user-entered text and AI receipt content outside the dictionary.
- Prepare fictional receipts and test data early. The anonymous browser-local demo uses a known sample image and labelled simulated extraction, never uploads a visitor's real image or calls Gemini. Real receipt processing requires sign-in.
- Manual entry remains a permanent fallback. Deploy the portfolio with screenshots, a short demo, truthful feature status, and an explanation of AI assistance.

## Testing Decisions

- Test observable behavior at pure calculation, server-operation, and browser-workflow boundaries. Cover financial invariants rather than target an arbitrary 100% coverage figure.
- Unit tests: quantities, equal and weighted subsets, rounding conservation, included versus added VAT, service charges, THB/USD conversion, and invalid financial inputs.
- Server tests: ownership isolation, draft confirmation, stale edits, cancellation, repayment changes, attachment permissions, and atomic writes.
- Extraction tests: Thai and English fixture receipts, unit-versus-line-price ambiguity, included/added VAT, absent fields, total discrepancies, malformed JSON, provider refusal/failure, timeout, quota exhaustion, and preserving existing drafts.
- Image preprocessing tests/checks: large source files, resulting byte limits, rotated photos, legible small text, decode failures including unsupported HEIC, cancellation, and multipart upload limits on the deployed environment.
- Mock the provider for automated tests. Manually evaluate live Gemini on fictional/redacted receipts, recording expected versus extracted values and corrections rather than promising perfect recognition.
- Browser checks: upload -> preview -> extract -> correct -> split -> save -> reload -> balance. Verify native one-photo capture on an actual target mobile device, including cancellation, retake, and upload fallback; desktop tests alone do not prove camera support.
- Add Vitest for calculations and a small Playwright suite for critical flows. CI runs lint, type checks, relevant tests, and build without live provider calls or production secrets.

## Out of Scope

- Shared multi-account group access, invitations, membership claims, recipient confirmations, and reversal approvals.
- Natural-language expense entry, continuous camera recognition, video, multi-image stitching, PDF receipts, and custom in-page camera controls.
- Full revision/audit history, two-language UI, live exchange-rate APIs, arbitrary currencies, multiple payers, custom exact-amount splits, fractional quantities, and automatic discount/refund handling.
- Bank transfers, payment-slip verification, automatic debt collection, and live AI for anonymous visitors.
- Firebase data migration.

## Delivery Plan

- Implementation order: (1) receipt-shaped manual draft and money tests; (2) owner authentication, persistence, and balances; (3) real image extraction and review; (4) native one-photo capture; (5) dashboard, demo, and documentation.
- Eleven implementation tasks are published as sub-issues of issue #1. Track completion and dependencies in GitHub Issues; update this specification when requirements change.
- Keep feature status explicit in the README and demo. The planned stack, validation strategy, and workflows above do not imply that those features are already implemented.

## Technical References

Verify provider availability and deployment limits when implementing the relevant task.

- [Mobile camera capture](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture)
- [Gemini image understanding](https://ai.google.dev/gemini-api/docs/image-understanding)
- [Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini model deprecations](https://ai.google.dev/gemini-api/docs/deprecations)
- [Client image compression](https://github.com/Donaldcwl/browser-image-compression)
- [Vercel function limits](https://vercel.com/docs/functions/limitations)
