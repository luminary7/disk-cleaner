## Why

The current cleanup rules are too permissive for a consumer disk-cleaning tool: broad app data directories such as WeChat/QQ document folders can be scanned as application cache and old user files may be labeled `safe`. Cleanup execution also relies too heavily on frontend selection, so safety policy needs to become an enforceable contract across scanning, recommendation, AI assistance, and deletion.

## What Changes

- Tighten standard scan targets so social app user data folders are not treated as cache.
- Redefine `safe`, `caution`, and `keep` as enforceable cleanup policy levels.
- Make one-click cleanup delete only `safe` items by default.
- Require explicit caution handling for `caution` items and block ordinary cleanup of `keep` items.
- Add backend deletion validation that re-checks path protection and safety level before moving items to the recycle bin.
- Change large-file analysis to discovery-first behavior: large files are mostly `caution` or `keep`, not default cleanup candidates.
- Make AI analysis advisory only: AI can raise risk but cannot downgrade rule-engine `keep`.
- Align the scan rules page and user-facing labels with the real policy.
- Add focused rule verification coverage for high-risk path and extension examples.

## Capabilities

### New Capabilities
- `cleanup-safety-policy`: Defines safe scan scope, safety-level semantics, backend deletion gates, large-file policy, AI advisory limits, and verification expectations for cleanup decisions.

### Modified Capabilities
<!-- No existing archived specs to modify. -->

## Impact

- Affected main-process files: `electron/scanner.js`, `electron/rule-engine.js`, `electron/file-operator.js`, `electron/main.js`.
- Affected preload/types: `electron/preload.js` if delete options are exposed, `src/vite-env.d.ts`.
- Affected renderer pages: `src/pages/SimpleMode.tsx`, `src/pages/CleanItems.tsx`, `src/pages/LargeFiles.tsx`, `src/pages/ScanRules.tsx`, and possibly `src/pages/SettingsPage.tsx` for restore-point messaging.
- New or updated verification script for rule samples, likely under `scripts/`.
- No dependency upgrades are required.
