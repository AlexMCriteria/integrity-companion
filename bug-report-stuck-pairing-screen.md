# Bug: Assessment Page Stuck on "Connecting to Companion App"

## Summary

The assessment page intermittently gets stuck on the "Connecting to Companion App" screen even though the Integrity Companion app has successfully paired and shows all checks green ("Proctoring Active").

This happens when starting a **new assessment session** without restarting the Electron companion app — i.e., first session works, subsequent sessions get stuck.

## Root Cause

In `main.js`, the `auto-pair` WebSocket handler has a guard that prevents re-pairing once any session has been paired:

```js
// main.js line 138 (before fix)
wsServer.on("auto-pair", async (incomingSessionId) => {
    if (sessionId) return; // Already paired — blocks ALL new sessions
    ...
});
```

The module-level `sessionId` variable is set on first pairing and **never cleared**. When a new assessment session is created (new UUID), the browser sends `auto-pair` with the new session ID, but Electron silently ignores it because `sessionId` is already truthy.

### Why the companion UI looks fine

`renderer.js` `init()` calls `getStatus()`, sees the old `sessionId` is set, and skips straight to the monitoring view with all checks green. It's displaying state from the **previous** session.

### Why the assessment page is stuck

The new session was never paired. Its database status remains `"waiting_for_companion"`. Both the SSE stream and the polling fallback correctly return this status — the problem is upstream in the companion app never updating it.

## Fix

**File: `main.js`** — Change the guard from "any session exists" to "same session already paired":

```diff
  wsServer.on('auto-pair', async (incomingSessionId) => {
-   if (sessionId) return; // Already paired
+   if (sessionId === incomingSessionId) return; // Same session, already paired

    sessionId = incomingSessionId;
    reporter.setSessionId(sessionId);
+   statusBeforePause = null;

    currentStatus = 'paired';
    sendToRenderer('session-status', 'paired');
    await reporter.updateStatus('paired');

    // Start the pre-check → ready flow
    runPreCheckAndReady();
  });
```

This allows the companion to re-pair when a new assessment session is created, while still preventing duplicate pairing for the same session.

## Secondary: Add Error Logging on Status Updates

All `reporter.updateStatus()` calls in `main.js` had their return values discarded. The companion UI updates optimistically (before the API call returns), so if the API call fails, the companion shows success but the assessment database is never updated.

Added error logging to every `updateStatus()` call site (`paired`, `pre_check`, `pre_check` blocking, `ready`, `paused`, resume). Example:

```diff
- await reporter.updateStatus('paired');
+ const pairResult = await reporter.updateStatus('paired');
+ if (pairResult.error) {
+   console.error('[Main] Failed to update status to paired:', pairResult.error);
+ }
```

This doesn't change behavior but makes failures visible in the Electron console for debugging.

## How to Reproduce

1. Start the Integrity Companion app
2. Start an assessment session in the browser — it pairs and works correctly
3. Go back to the home page and start a **new** assessment session
4. The assessment page gets stuck on "Connecting to Companion App" with a green dot and "Connected — pairing automatically..."
5. The companion sidebar still shows "Proctoring Active" with all checks green (stale state from step 2)

## Files Changed

- `main.js` — Auto-pair guard fix + error logging on all `reporter.updateStatus()` calls
