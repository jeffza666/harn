# Harn

Harn is a Thai-first receipt bill splitter. Upload one receipt, check the items the model read, choose who shared each line, and see who owes the person who paid.

This repository is a browser-local MVP. It does not sign anyone in and it does not save bills. The full plan is in [docs/specs/harn-v1.md](docs/specs/harn-v1.md).

## What works now

- Landing page, then five steps: people, receipt, items, assignment, summary
- A fictional sample receipt and three sample friends, labelled as a simulation
- Manual add, edit, and remove of items
- JPEG, PNG, and WebP upload, plus a phone camera input, with preview, replace, and cancel
- Client resize to a JPEG around 2 MB. Files still over 3 MB are refused. HEIC is rejected with export instructions and is never renamed to JPEG
- `POST /api/extract` sends that JPEG to Gemini. The key stays on the server
- Included VAT stays inside item prices. Added VAT and service can be split equally or by item share
- Equal splits and group weights such as 60/40, in integer satang, with the shares adding up to the total
- A printed-total check that blocks the summary until the lines are fixed or confirmed with a note
- USD bills converted with a rate and date you type, then split in baht
- A Thai summary you can copy into a chat
- The sample path when `GEMINI_API_KEY` is empty

## What the v1 spec still needs

- Google sign-in, owned groups, Prisma, and Supabase
- Saved drafts, confirmed bills, balances, and recorded repayments
- Private storage for receipt images
- Monthly and participant charts
- A real per-owner quota. This MVP only keeps a short in-memory limit on the server process
- Playwright, and a camera check on an actual phone
- Decoding the image pixels on the server. The route checks the file signature and header dimensions
- An English UI, live exchange rates, and shared accounts

Until sign-in exists, a configured key will read a photo without an account. The upload step says the image is sent to Google. Do not use a real receipt that has personal data in this build.

## Stack

Next.js (App Router), React, TypeScript, and Tailwind CSS. Amounts are integer minor units. Gemini is called with the Interactions API. The default model is `gemini-3.8-flash`. Zod checks the JSON before it becomes an editable draft.

## Setup

Use Node.js 22.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **ลองด้วยข้อมูลตัวอย่าง** opens the fictional bill. Nothing is uploaded.
- **เริ่มหารบิล** starts at the people step. Use the sample, type the bill, or upload a photo.

### Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | Only for real photos | Server-only Google AI key. Leave it blank to stay on the sample path. |
| `GEMINI_MODEL` | No | Flash vision model. Default `gemini-3.8-flash`. Image-generation, preview, and retired 1.5 / 2.0 ids are rejected. |

Copy `.env.example` to `.env.local`. Do not commit `.env.local` or a real key. Restart `npm run dev` after changing it.

```bash
npm test
npm run lint
npm run build
```

CI runs lint, the unit tests, and the production build. It does not call Gemini.

## How the split is calculated

A line is the unit price times the quantity. The people selected on that line share it equally, or by the positive weights from the people step. If the leftover satang cannot be divided, the earliest person in the list gets it.

Added VAT and added service are shared on their own, equally or in proportion to item responsibility. Included tax is shown and is not added again. For USD, the whole total is converted to baht with half-up rounding, then that baht total is split so the baht shares match it. A mismatch with the printed subtotal or total must be corrected or confirmed with a note.

## AI assistance

The sample button does not call a model. A real upload is sent from the server to Google Gemini, and every line should be checked before anyone is asked to pay. Recognition will be wrong sometimes; manual entry stays available. This MVP was written with help from an AI coding agent in Cursor. The unit tests check the money rules. They do not promise that a photo will be read perfectly.
