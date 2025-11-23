let valorantActive = false;
let valorantInFocus = false;
let overlaySuppressed = false;
let listenersAttached = false;
let featuresReady = false;
let overlayAwaitingFeatureNotice = false;

const MAX_FEATURE_ATTEMPTS = 5;
const FEATURE_RETRY_DELAY_MS = 3000;
let featureRetryTimer: any = null;

const OVERLAY_MARGIN_X = 50;
const OVERLAY_MARGIN_Y = 32;

const VALORANT_ID = 21640;
const REQUIRED_FEATURES = [
  "me",
  "game_info",
  "match_info",
  "kill",
  "death"
];

function clearFeatureRetry() {
  if (featureRetryTimer) {
    try { clearTimeout(featureRetryTimer); } catch { }
    featureRetryTimer = null;
  }
}

function resetFeatureTracking() {
  featuresReady = false;
  overlayAwaitingFeatureNotice = false;
  clearFeatureRetry();
}

function isValorant(info: any) {
  return info && info.classId === VALORANT_ID;
}

function forwardToMain(payload: any) {
  try {
    const message = { source: "valorant", payload };
    const send = (w: any) => {
      try { overwolf.windows.sendMessage(w.id, "valorant-event", message, () => { }); } catch { }
    };
    obtain('main', send);
    obtain('desktop', send);
  } catch { }
}

function obtain(id: string, cb: (w: any) => void) {
  overwolf.windows.obtainDeclaredWindow(id, (res: any) => {
    try {
      if (res && res.success && res.window) {
        cb(res.window);
      } else {
        console.warn('[OW] obtainDeclaredWindow failed', id, res);
      }
    } catch (e) {
      console.error('[OW] obtainDeclaredWindow error', id, e);
    }
  });
}

let isOverlayVisible = false;

let hideTimer: any = null;

function showMain() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  obtain('main', (w) => {
    overwolf.windows.restore(w.id, async () => {
      console.log('[Background] Restoring main window');
      try {
        const monitors = await new Promise<any>((resolve) => overwolf.utils.getMonitorsList(resolve));
        const primary = monitors && monitors.primary ? monitors.primary : monitors?.monitors?.[0];
        const screenW = primary?.width || 1920;
        const corner = (typeof localStorage !== 'undefined' && localStorage.getItem('overlay_corner')) || 'right';
        const overlayW = 460;
        const x = corner === 'right'
          ? Math.max(OVERLAY_MARGIN_X, screenW - overlayW - OVERLAY_MARGIN_X)
          : OVERLAY_MARGIN_X;
        const y = OVERLAY_MARGIN_Y;
        overwolf.windows.changePosition(w.id, x, y, () => { });
      } catch { }
      overwolf.windows.bringToFront(w.id, false, () => { });
      isOverlayVisible = true;
    });
  });
}

function hideMain() {
  if (hideTimer) return; // Already scheduled
  hideTimer = setTimeout(() => {
    obtain('main', (w) => {
      overwolf.windows.hide(w.id);
      isOverlayVisible = false;
    });
    hideTimer = null;
  }, 2000); // 2 second grace period
}

function autoShowOverlay() {
  if (!valorantActive || overlaySuppressed) return;
  if (featuresReady) {
    overlayAwaitingFeatureNotice = false;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    if (!isOverlayVisible) {
      showMain();
    }
  } else {
    if (!overlayAwaitingFeatureNotice) {
      overlayAwaitingFeatureNotice = true;
      forwardToMain({ type: 'overlay_waiting_for_features' });
    }
  }
}

function toggleMain() {
  obtain('main', (w) => {
    overwolf.windows.getWindowState(w.id, (st: any) => {
      // If window is 'normal' or 'maximized' and visible, we hide it.
      // Otherwise (closed, hidden, minimized), we restore it.
      const isVisible = st && st.success && (st.window_state === 'normal' || st.window_state === 'maximized');

      if (isVisible && !overlaySuppressed) {
        overlaySuppressed = true;
        overwolf.windows.hide(w.id);
        forwardToMain({ type: 'overlay_hidden' });
      } else {
        overlaySuppressed = false;
        overwolf.windows.restore(w.id, () => {
          overwolf.windows.bringToFront(w.id, false, () => { });
          forwardToMain({ type: 'overlay_shown' });
        });
      }
    });
  });
}

function showDesktop() {
  obtain('desktop', (w) => {
    try {
      overwolf.windows.restore(w.id, () => {
        overwolf.windows.bringToFront(w.id, false, () => { });
      });
    } catch (e) {
      console.error('[OW] showDesktop failed', e);
    }
  });
}

function updateDesktopVisibility() {
  if (!valorantActive) {
    showDesktop();
    return;
  }
  if (valorantInFocus) {
    hideDesktop();
  } else {
    showDesktop();
  }
}

function hideDesktop() {
  obtain('desktop', (w) => {
    overwolf.windows.hide(w.id);
  });
}

function checkHotkeyConflicts() {
  try {
    overwolf.settings.hotkeys.get((res: any) => {
      const list = res?.success ? (res.hotkeys || []) : []
      const bindings: Record<string, string> = {}
      const conflicts: string[] = []
      for (const h of list) {
        const name = h?.name
        const binding = h?.binding || h?.hotkey || ''
        if (!name || !binding) continue
        const key = binding.toLowerCase()
        if (bindings[key]) {
          conflicts.push(`${bindings[key]}<>${name}`)
        } else {
          bindings[key] = name
        }
      }
      if (conflicts.length) {
        forwardToMain({ type: 'hotkey_conflict', data: { conflicts } })
      }
    })
  } catch { }
}

function checkHotkeysAssigned() {
  try {
    overwolf.settings.hotkeys.get((res: any) => {
      const list = res?.success ? (res.hotkeys || []) : []
      const required = ['toggle_app', 'toggle_desktop', 'voice_command', 'toggle_settings']
      const map: Record<string, any> = {}
      for (const h of list) { if (h?.name) map[h.name] = h }
      const missing = required.filter((r) => !((map[r]?.binding || map[r]?.hotkey)))
      if (missing.length) {
        forwardToMain({ type: 'hotkey_unassigned', data: { missing } })
        try {
          const first = missing[0]
          const url = `overwolf://settings/games-overlay?hotkey=${first}&gameId=${VALORANT_ID}`
          overwolf.utils.openUrl(url)
        } catch { }
      }
    })
  } catch { }
}

function ensureOverlayEnabled() {
  try {
    overwolf.settings.games.getOverlayEnabled(21640, (r: any) => {
      const enabled = !!(r && r.enabled)
      forwardToMain({ type: 'overlay_enabled', data: { enabled } })
    })
  } catch { }
}

function toggleDesktop() {
  obtain('desktop', (w) => {
    overwolf.windows.getWindowState(w.id, (st: any) => {
      const vis = st && st.success && st.window_state !== 'closed' && st.window_state !== 'hidden';
      if (vis) {
        overwolf.windows.hide(w.id);
      } else {
        overwolf.windows.restore(w.id, () => overwolf.windows.bringToFront(w.id, false, () => { }));
      }
    });
  });
}

function requestInitialInfo() {
  try {
    overwolf.games.events.getInfo((res: any) => {
      console.log('[Background] getInfo result:', res);
      if (res?.res) {
        forwardToMain({ type: 'info_update', data: { info: res.res } });
        updateMatchState(res.res);
      }
      forwardToMain({ type: 'initial_info', data: res });
    });
  } catch { }
}

// ...

(window as any).handleOverlayRequest = (type: string) => {
  console.log('[Background] handleOverlayRequest:', type);
  if (type === 'request_full_state') {
    if (valorantActive && featuresReady) {
      requestInitialInfo();
    } else {
      console.log('[Background] Skipping info request - Active:', valorantActive, 'Features:', featuresReady);
    }
    try {
      overwolf.settings.hotkeys.get((res: any) => {
        forwardToMain({ type: 'hotkeys_sync', data: res });
      });
    } catch { }
  }
};

function scheduleFeatureRetry(nextAttempt: number) {
  if (!valorantActive) return;
  clearFeatureRetry();
  featureRetryTimer = setTimeout(() => attemptSetFeatures(nextAttempt), FEATURE_RETRY_DELAY_MS);
}

function attemptSetFeatures(attempt: number) {
  console.log(`[Background] Attempting to set features (Attempt ${attempt + 1}/${MAX_FEATURE_ATTEMPTS})...`);
  overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (res: any) => {
    console.log('[Background] setRequiredFeatures result:', res);
    forwardToMain({ type: "features_set", data: { ...res, attempt } });
    if (!valorantActive) {
      resetFeatureTracking();
      return;
    }
    if (res?.status === 'success') {
      console.log('[Background] Features set successfully:', res.supportedFeatures);
      featuresReady = true;
      clearFeatureRetry();
      requestInitialInfo();
      autoShowOverlay();
      return;
    }
    featuresReady = false;
    console.warn('[Background] Failed to set features:', res);
    if (attempt + 1 < MAX_FEATURE_ATTEMPTS) {
      scheduleFeatureRetry(attempt + 1);
    } else {
      forwardToMain({ type: 'features_failed', data: res });
    }
  });
}

function setFeatures() {
  resetFeatureTracking();
  attemptSetFeatures(0);
}

let inMatch = false;

function updateMatchState(info: any) {
  if (!info) return;

  if (info.game_info) {
    const gi = info.game_info;
    if (gi.scene) {
      // MainMenu is definitely not in-match.
      // CharacterSelectPersistentLevel is Agent Select (we want overlay).
      // Map names (Triad, etc.) are in-match.
      if (gi.scene === 'MainMenu') inMatch = false;
      else if (gi.scene === 'CharacterSelectPersistentLevel') inMatch = true; // Agent Select is "in-game" for us
      else inMatch = true;
    }
    if (gi.state) {
      if (gi.state === 'InProgress') inMatch = true;
      else if (gi.state === 'Aborted' || gi.state === 'LeavingMap') inMatch = false;
    }
  }

  if (info.match_info) {
    const mi = info.match_info;
    // If we have round info, we are definitely in a match
    if (mi.round_phase || (mi.round_number && Number(mi.round_number) > 0)) {
      inMatch = true;
    }
    // If match outcome is present, match is ending
    if (mi.match_outcome) {
      // We might want to keep overlay for a bit to show stats, but strictly speaking match is over.
      // Let's keep it true for 'victory'/'defeat' screens usually? 
      // But 'MainMenu' signal usually follows.
    }
  }

  if (inMatch) {
    autoShowOverlay();
  } else {
    // User requested overlay to stay visible even if not strictly "in match"
    // as long as game is running.
    // We still want to auto-show if hidden, so let's try showing it.
    autoShowOverlay();
  }
}

function initListeners() {
  if (listenersAttached) return;
  overwolf.games.events.onNewEvents.addListener((e: any) => {
    forwardToMain({ type: "new_events", data: e });
  });
  overwolf.games.events.onInfoUpdates.addListener((e: any) => {
    forwardToMain({ type: "info_update", data: e });
    try {
      updateMatchState(e?.info);
    } catch { }
  });
  listenersAttached = true;
}

function tryInitForValorant() {
  overwolf.games.getRunningGameInfo((info: any) => {
    if (isValorant(info)) {
      valorantActive = true;
      valorantInFocus = Boolean(info?.isInFocus !== false);
      setFeatures();
      initListeners();
      forwardToMain({ type: "game_detected", data: info });
      autoShowOverlay();
      updateDesktopVisibility();
    } else {
      valorantActive = false;
      valorantInFocus = false;
      resetFeatureTracking();
      forwardToMain({ type: "no_game" });
      showDesktop(); // Auto-open desktop on startup if game not running (Manual Launch)
    }
  });
}

overwolf.games.onGameInfoUpdated.addListener((e: any) => {
  const gameInfo = e && e.gameInfo;
  if (isValorant(gameInfo)) {
    valorantActive = true;
    valorantInFocus = Boolean(gameInfo?.isInFocus !== false);
    setFeatures();
    initListeners();
    forwardToMain({ type: "game_detected", data: gameInfo });
    autoShowOverlay();
    updateDesktopVisibility();
  } else {
    valorantActive = false;
    valorantInFocus = false;
    resetFeatureTracking();
    hideMain();
    showDesktop();
    forwardToMain({ type: "no_game" });
  }
});

try {
  overwolf.settings.hotkeys.onPressed.addListener((e: any) => {
    forwardToMain({ type: 'debug_log', data: `onPressed: ${e?.name}` });
    // Ignore voice_command in onPressed, handled by onHold
    if (e?.name === 'voice_command') return;

    forwardToMain({ type: 'hotkey_pressed', data: { name: e?.name } })
    if (e && e.name === 'toggle_app') toggleMain();
    if (e && e.name === 'toggle_desktop') {
      toggleDesktop();
    }
  });
} catch { }

try {
  overwolf.settings.hotkeys.onHold.addListener((e: any) => {
    forwardToMain({ type: 'debug_log', data: `onHold: ${e?.name} state=${e?.state}` });
    if (e?.name === 'voice_command') {
      forwardToMain({ type: 'voice_command_state', data: { state: e.state } });
    }
  });
} catch { }

try {
  overwolf.settings.hotkeys.onChanged.addListener((e: any) => {
    try {
      const name = e?.name
      const binding = e?.binding || e?.hotkey
      forwardToMain({ type: 'hotkey_changed', data: { name, binding } })
      checkHotkeyConflicts()
    } catch { }
  })
} catch { }

try {
  overwolf.extensions.onAppLaunchTriggered.addListener(() => {
    try {
      overwolf.games.getRunningGameInfo((info: any) => {
        if (isValorant(info)) {
          showMain();
          hideDesktop();
        } else {
          showDesktop();
        }
      });
    } catch {
      showDesktop();
    }
  });
} catch { }

try { ensureOverlayEnabled(); checkHotkeyConflicts(); checkHotkeysAssigned() } catch { }

overwolf.windows.onMessageReceived.addListener((message: any) => {
  if (message?.content?.type === 'request_full_state') {
    if (valorantActive && featuresReady) {
      requestInitialInfo();
    }
    try {
      overwolf.settings.hotkeys.get((res: any) => {
        forwardToMain({ type: 'hotkeys_sync', data: res });
      });
    } catch { }
  }
});

tryInitForValorant();

(window as any).handleOverlayRequest = (type: string) => {
  console.log('[Background] handleOverlayRequest:', type);
  if (type === 'request_full_state') {
    if (valorantActive && featuresReady) {
      requestInitialInfo();
    } else {
      console.log('[Background] Skipping info request - Active:', valorantActive, 'Features:', featuresReady);
    }
    try {
      overwolf.settings.hotkeys.get((res: any) => {
        forwardToMain({ type: 'hotkeys_sync', data: res });
      });
    } catch { }
  }
};
