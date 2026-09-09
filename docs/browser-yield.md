# Cooperative browser task yields

[Issue #59](https://github.com/lictl/WebRA2/issues/59) replaces the import/hash
checkpoints' zero-delay timers with
[`yieldBrowserTask(signal?)`](../packages/vfs/src/browser-yield.ts). It posts a
constant numeric message through a new MessageChannel, resumes after message
delivery and closes both ports. The message carries no game data. This yields to
an event-loop task; it does not spin a microtask loop, wait actively, change
simulation timing, require a Worker or alter browser settings.

The scheduling change addresses a hypothesis from actual app testing: Safari and
Edge imports advanced only a few checkpoints over minutes while native automation
left their windows backgrounded. Timer throttling could explain that observation;
it is not established as the sole cause. Actual before/after browser validation
belongs to [the app #27](https://github.com/lictl/WebRA2/issues/27) and
[integration #56](https://github.com/lictl/WebRA2/issues/56). Passing this component's
tests does not establish four-browser import acceptance.

## Lifetime and behavior

Each invocation has one task and two private message ports. Success, abort and
message/posting errors clear handlers, remove the abort listener and close the
ports. Already-aborted calls create no channel. An abort during channel construction
also closes the returned ports. Completion is idempotent, so a late delivery cannot
resolve a cancelled operation or decrement the pending count twice.

At most 32 invocations can be pending in one loaded module, including timer
fallbacks. The next call rejects with `browser-yield-limit` before allocation.
Independent/reentrant invocations have separate ownership, while the existing
import/hash callers await each checkpoint sequentially. This bounds pending helper
resources to 64 ports; it is not a total browser process memory claim.

Cancellation rejects with `AbortError`. Constructor/posting failure rejects with
`browser-yield-schedule`; message delivery failure uses `browser-yield-message`.
If MessageChannel is unavailable, one cancellable `setTimeout(0)` preserves a task
boundary. It retains timer scheduling limitations. A present but failing channel
does not silently switch scheduling mechanisms or retry indefinitely.

Only the scheduling primitive changes. Import read/record/depth limits, checkpoint
frequency, progress callbacks and post-yield cancellation checks remain intact.
Incremental hashing retains its chunk limits, post-yield abort check and final
source-size check. Timer and MessageChannel tasks have different task sources;
their relative execution order is not an application guarantee.

## Platform evidence and limits

The [HTML Standard's message-port model](https://html.spec.whatwg.org/multipage/web-messaging.html#message-ports)
defines posted-message task delivery and port lifetime. API references describe
[MessageChannel](https://developer.mozilla.org/en-US/docs/Web/API/MessageChannel)
and [explicit port closing](https://developer.mozilla.org/en-US/docs/Web/API/MessagePort/close).
The [timer documentation](https://developer.mozilla.org/en-US/docs/Web/API/Window/setTimeout#reasons_for_delays_longer_than_specified)
records reasons why zero-delay timers can execute later, including inactive tabs.
These primary platform references were checked on 2026-09-10. No implementation code
was copied from them.

MessageChannel does not guarantee background execution, rendering opportunities,
completion latency or execution in a suspended tab. The browser still controls
task scheduling and page lifecycle. Actual foreground progress/cancel measurements
must use the integrated app and the reference-browser acceptance budget. This change
does not claim that posting messages defeats every form of background throttling.

## Verification and provenance

With Node 24.20.0 and `npm ci`:

```sh
node --import tsx --test tests/vfs/browser-yield.test.ts tests/vfs/hash-source.test.ts
npm run check
git diff --check
```

Seven original helper tests cover a native task boundary, success/late delivery,
abort before/during construction and after posting, reentrancy, the allocation cap,
both-port cleanup, scheduling/message failures and the cancellable timer fallback.
They assert lifecycle and ordering without elapsed-time thresholds. Existing hash
tests retain final-progress and empty-range mutation checks; the final-yield check
now injects mutation at message delivery instead of assuming timer-task ordering.
The importer and verified-source test suites still run as part of the full check.

The original helper and tests are GPL-3.0-or-later, consistent with the import/hash
modules they compose. No new dependency, retail fixture or native binary is added.
See [project licensing](licensing.md), [import scope](browser-import.md),
[hash provenance](../packages/vfs/HASH_PROVENANCE.md) and
[verified sessions](browser-verified.md).
