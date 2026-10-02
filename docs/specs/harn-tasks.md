# Harn v1 task plan

Specification: [GitHub issue #1](https://github.com/jeffza666/harn/issues/1).
Scope and design decisions: [v1 specification](harn-v1.md).

These are planned tasks, not completed features. GitHub issue Open/Closed state
is the source of truth for progress. Requirements and dependencies can change
as implementation reveals new information; record the reason in the issue.

| Task | GitHub issue | Prerequisite issues |
| --- | --- | --- |
| 01 | [Build an editable manual receipt draft](https://github.com/jeffza666/harn/issues/2) | None |
| 02 | [Split items and reconcile receipt totals](https://github.com/jeffza666/harn/issues/3) | #2 |
| 03 | [Sign in and manage privately owned groups](https://github.com/jeffza666/harn/issues/4) | None |
| 04 | [Persist bills and display net balances](https://github.com/jeffza666/harn/issues/5) | #3, #4 |
| 05 | [Support USD bills and owner-recorded repayments](https://github.com/jeffza666/harn/issues/6) | #5 |
| 06 | [Upload, preview, and compress receipt images](https://github.com/jeffza666/harn/issues/7) | #2 |
| 07 | [Extract a reviewable receipt draft with Gemini](https://github.com/jeffza666/harn/issues/8) | #5, #7 |
| 08 | [Capture one receipt photo on mobile](https://github.com/jeffza666/harn/issues/9) | #7 |
| 09 | [Attach receipts privately to saved bills](https://github.com/jeffza666/harn/issues/10) | #8 |
| 10 | [Show monthly spending and participant dashboards](https://github.com/jeffza666/harn/issues/11) | #6 |
| 11 | [Deliver the anonymous demo and portfolio documentation](https://github.com/jeffza666/harn/issues/12) | #8, #9, #10, #11 |

Start with Task 01 to establish the editable receipt draft used by both manual
entry and AI extraction. A prerequisite issue must be completed before its
dependent task can be completed; GitHub displays these relationships as Blocked.

Task numbers describe the delivery sequence. GitHub issue numbers identify
the tickets: Task 01 is issue #2 because issue #1 contains the specification.
Each ticket contains its acceptance criteria. Close it after implementation
and verification, rather than when work begins.
