## Context

The app is an Electron + React Windows disk-cleaning tool. Standard scanning is implemented in `electron/scanner.js`, item safety is assigned by `electron/rule-engine.js`, cleanup is executed through `electron/file-operator.js` and `electron/main.js`, and renderer pages choose which items to pass to cleanup.

The current policy is not consistently enforced. Some scan targets include broad social-app user data directories, the rule engine can label old app files as `safe`, one-click cleanup includes every item that is not `keep`, and the backend deletion path only checks protected path exclusions. The change must reduce false-positive deletion risk while keeping the existing app architecture and IPC style.

## Goals / Non-Goals

**Goals:**
- Make `safe`, `caution`, and `keep` an enforceable cleanup contract.
- Ensure one-click cleanup only removes `safe` items.
- Prevent broad user-data directories from entering standard cache cleanup.
- Make backend cleanup revalidate safety before moving files to the recycle bin.
- Keep AI recommendations advisory and unable to downgrade `keep`.
- Add focused verification for representative high-risk paths and extensions.

**Non-Goals:**
- Do not add a user-editable rule builder.
- Do not implement permanent deletion.
- Do not rewrite the scanner architecture or introduce a database.
- Do not add new dependencies or broad dependency upgrades.
- Do not build a separate social-app media cleanup workflow in this change.

## Decisions

### Decision: Treat backend validation as the final safety boundary

Cleanup execution will validate the submitted item against protected paths and the current rule engine before deletion. `safe` items are allowed by default, `caution` items require an explicit cleanup option, and `keep` items are rejected by ordinary cleanup.

Alternative considered: rely on frontend filtering and modals only. This is simpler but unsafe because IPC callers, UI bugs, or future pages could send risky items directly to `clean:execute`.

### Decision: Make one-click cleanup safe-only

Simple mode will present default cleanup as safe cleanup. `caution` items can be surfaced as reviewable space, but they must not be included in the primary one-click action.

Alternative considered: keep "delete all non-keep" and improve warnings. This preserves current freed-space numbers but keeps the riskiest behavior in the easiest path.

### Decision: Narrow standard app scan targets instead of trying to classify every app file

The scanner will stop treating broad paths such as `Documents\WeChat Files` and `Documents\Tencent Files` as cache sources. Standard app scan targets should point only to known cache, temp, log, thumbnail, crash, or webview-cache directories.

Alternative considered: keep broad paths and add more filename heuristics. That would remain fragile because social-app folders contain arbitrary user documents with ordinary extensions such as PDF, JPG, DOCX, and XLSX.

### Decision: Make large-file analysis discovery-first

Large-file scanning will avoid assigning `safe` broadly. Installers, archives, videos, and disk images found outside explicit cache/temp paths will be `caution` or `keep`. This keeps large-file cleanup user-driven.

Alternative considered: keep package/archive files as `safe` because they are often redownloadable. This is too aggressive for whole-disk scanning, where archives may be backups or project assets.

### Decision: AI can raise risk but not lower rule-engine `keep`

The effective safety level displayed and used by large-file actions will be the more conservative of rule-engine safety and AI safety. AI may change `safe` to `caution` or `keep`, or `caution` to `keep`, but it cannot make a rule-engine `keep` deletable.

Alternative considered: let AI override the rule engine. This may look helpful, but AI only sees metadata and can misinterpret user data or proprietary files.

### Decision: Add a lightweight rule verification script

Because the project has no test framework, this change will add a small Node-based verification command that imports the rule engine and asserts expected safety for representative sample paths. The script will be focused and deterministic.

Alternative considered: add a full test framework. That is more infrastructure than this safety hardening needs.

## Risks / Trade-offs

- [Risk] Users may see less reclaimable space in one-click cleanup. -> Mitigation: show separate safe and review-required totals so the behavior is understandable.
- [Risk] Some real caches inside social-app folders may no longer be found. -> Mitigation: include only known cache-like subdirectories and leave a future dedicated social-app cleanup workflow out of scope.
- [Risk] Re-evaluating items at delete time can disagree with stale UI state. -> Mitigation: backend result messages should report blocked items clearly so the UI can keep them in the list.
- [Risk] Restore point creation can create a false sense that user files are recoverable. -> Mitigation: UI copy should distinguish Windows system restore from recycle-bin recovery.
- [Risk] Rule sample coverage can become stale as rules evolve. -> Mitigation: keep samples tied to policy-level expectations rather than implementation internals.

## Migration Plan

1. Update the rule engine policy and scanner targets.
2. Update cleanup IPC and file-operator validation to enforce the policy.
3. Update renderer selection and wording so default cleanup is safe-only and caution cleanup is explicit.
4. Update large-file AI combination logic to use conservative safety.
5. Update ScanRules content to match the implemented policy.
6. Add and run the focused verification script plus the existing build.

Rollback is straightforward: revert this change set. No persisted data migration is required.

## Open Questions

- Exact WeChat/QQ/DingTalk cache subpaths may vary by installation and version. The implementation should use a conservative initial allowlist and skip missing paths silently.
- If restore-point creation is wired into cleanup, the implementation must decide whether failure blocks caution cleanup or only warns. The recommended behavior is to allow safe cleanup and require confirmation for caution cleanup if restore-point creation fails.
