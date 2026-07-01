## 1. Rule Engine Policy

- [x] 1.1 Update `electron/rule-engine.js` so `safe`, `caution`, and `keep` match the cleanup policy in `cleanup-safety-policy`.
- [x] 1.2 Ensure user-data marker paths cannot become `safe` only because a file is old.
- [x] 1.3 Ensure unknown extensions and no-extension files remain `keep`.
- [x] 1.4 Change large-file archive, installer, and disk-image behavior outside explicit cache/temp paths from `safe` to `caution`.
- [x] 1.5 Add or refine high-risk large-file patterns so virtual disks, game resources, dependency folders, environments, and unknown large files become `keep`.

## 2. Scan Target Scope

- [x] 2.1 Remove broad social-app user data folders such as `Documents\WeChat Files` and `Documents\Tencent Files` from standard app cache targets.
- [x] 2.2 Add a conservative allowlist of known cache-like app subdirectories for supported apps where paths are known.
- [x] 2.3 Keep missing app cache subdirectories as silent skips without scan failure.
- [x] 2.4 Confirm standard scanning no longer reports representative WeChat/QQ user documents as `safe`.

## 3. Backend Cleanup Enforcement

- [x] 3.1 Change cleanup execution so backend deletion receives enough item context and cleanup options to validate safety.
- [x] 3.2 Revalidate normalized paths against protected exclusions before every delete.
- [x] 3.3 Re-evaluate item safety in the backend before every delete.
- [x] 3.4 Reject `keep` items from ordinary cleanup and return a clear blocked-by-policy error.
- [x] 3.5 Reject `caution` items unless the cleanup request explicitly allows caution cleanup.
- [x] 3.6 Keep all accepted cleanup operations moving items to the recycle bin only.

## 4. Renderer Cleanup Flows

- [x] 4.1 Update `SimpleMode.tsx` so the primary cleanup action submits only `safe` items.
- [x] 4.2 Show `caution` item count and size separately as review-required space in simple mode.
- [x] 4.3 Update `CleanItems.tsx` so default selection remains safe-only and caution cleanup requires explicit confirmation.
- [x] 4.4 Disable, hide, or otherwise remove ordinary delete behavior for `keep` items in itemized cleanup.
- [x] 4.5 Ensure single-item deletion follows the same `safe`/`caution`/`keep` policy as batch deletion.

## 5. Large File And AI Behavior

- [x] 5.1 Update `LargeFiles.tsx` effective safety calculation to use the more conservative level between rule-engine safety and AI safety.
- [x] 5.2 Prevent AI results from enabling deletion of rule-engine `keep` items.
- [x] 5.3 Keep large-file cleanup user-driven and outside the default one-click cleanup path.
- [x] 5.4 Update large-file selection, filters, confirmation, and blocked-item handling to match effective safety.

## 6. Restore Point And User-Facing Policy Copy

- [x] 6.1 Decide and implement the restore-point behavior described in the design: wire it before risky cleanup or adjust copy so it does not imply user-file recovery.
- [x] 6.2 Update `ScanRules.tsx` so displayed scan scope, safety meanings, large-file policy, AI limitation, and backend validation match real behavior.
- [x] 6.3 Update button labels and confirmation copy so default cleanup, caution cleanup, and blocked keep items are clearly distinguished.

## 7. Verification

- [x] 7.1 Add a focused Node verification script for rule-engine sample paths and expected safety levels.
- [x] 7.2 Cover protected system paths, old and recent temp files, social-app user documents, archives, game resources, virtual disks, unknown extensions, and user-data paths in the verification script.
- [x] 7.3 Run the new rule verification command and fix any failing samples.
- [x] 7.4 Run `npm run build` and fix build errors.
- [x] 7.5 Manually verify default cleanup sends only `safe` items and backend blocks submitted `keep` items.
