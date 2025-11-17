let valorantActive = false;
let overlaySuppressed = false;

const VALORANT_ID = 21640;
const REQUIRED_FEATURES = [
  "me",
  "game_info",
  "match_info",
  "kill",
  "death"
];

function isValorant(info: any) {
  return info && info.classId === VALORANT_ID;
}

function forwardToMain(payload: any) {
  try {
    const message = JSON.stringify({ source: "valorant", payload });
    obtain('main', (w) => {
      try { overwolf.windows.sendMessage(w.id, message, () => {}); } catch {}
    });
    obtain('desktop', (w) => {
      try { overwolf.windows.sendMessage(w.id, message, () => {}); } catch {}
    });
  } catch {}
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

function showMain() {
  obtain('main', (w) => {
    overwolf.windows.restore(w.id, async () => {
      try {
        const monitors = await new Promise<any>((resolve) => overwolf.utils.getMonitorsList(resolve));
        const primary = monitors && monitors.primary ? monitors.primary : monitors?.monitors?.[0];
        const screenW = primary?.width || 1920;
        const corner = (typeof localStorage !== 'undefined' && localStorage.getItem('overlay_corner')) || 'right';
        const overlayW = 420;
        const x = corner === 'right' ? Math.max(16, screenW - overlayW - 24) : 16;
        const y = 16;
        overwolf.windows.changePosition(w.id, x, y, () => {});
      } catch {}
      overwolf.windows.bringToFront(w.id);
    });
  });
}

function hideMain() {
  obtain('main', (w) => {
    overwolf.windows.hide(w.id);
  });
}

function toggleMain() {
  obtain('main', (w) => {
    overwolf.windows.getWindowState(w.id, (st: any) => {
      const vis = st && st.success && st.window_state !== 'closed' && st.window_state !== 'hidden';
      if (vis) {
        overlaySuppressed = true;
        overwolf.windows.hide(w.id);
        forwardToMain({ type: 'overlay_hidden' });
      } else {
        overlaySuppressed = false;
        overwolf.windows.restore(w.id, () => overwolf.windows.bringToFront(w.id));
        forwardToMain({ type: 'overlay_shown' });
      }
    });
  });
}

function showDesktop() {
  obtain('desktop', (w) => {
    try {
      overwolf.windows.restore(w.id, () => {
        overwolf.windows.bringToFront(w.id);
      });
    } catch (e) {
      console.error('[OW] showDesktop failed', e);
    }
  });
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
  } catch {}
}

function checkHotkeysAssigned() {
  try {
    overwolf.settings.hotkeys.get((res: any) => {
      const list = res?.success ? (res.hotkeys || []) : []
      const required = ['toggle_app','toggle_desktop','voice_command','toggle_settings']
      const map: Record<string, any> = {}
      for (const h of list) { if (h?.name) map[h.name] = h }
      const missing = required.filter((r) => !((map[r]?.binding || map[r]?.hotkey)))
      if (missing.length) {
        forwardToMain({ type: 'hotkey_unassigned', data: { missing } })
        try {
          const first = missing[0]
          const url = `overwolf://settings/games-overlay?hotkey=${first}&gameId=${VALORANT_ID}`
          overwolf.utils.openUrl(url)
        } catch {}
      }
    })
  } catch {}
}

function ensureOverlayEnabled() {
  try {
    overwolf.settings.games.getOverlayEnabled(21640, (r: any) => {
      const enabled = !!(r && r.enabled)
      forwardToMain({ type: 'overlay_enabled', data: { enabled } })
    })
  } catch {}
}

function toggleDesktop() {
  obtain('desktop', (w) => {
    overwolf.windows.getWindowState(w.id, (st: any) => {
      const vis = st && st.success && st.window_state !== 'closed' && st.window_state !== 'hidden';
      if (vis) {
        overwolf.windows.hide(w.id);
      } else {
        overwolf.windows.restore(w.id, () => overwolf.windows.bringToFront(w.id));
      }
    });
  });
}

function setFeatures() {
  overwolf.games.events.setRequiredFeatures(REQUIRED_FEATURES, (res: any) => {
    forwardToMain({ type: "features_set", data: res });
  });
}

function initListeners() {
  overwolf.games.events.onNewEvents.addListener((e: any) => {
    forwardToMain({ type: "new_events", data: e });
  });
  overwolf.games.events.onInfoUpdates.addListener((e: any) => {
    forwardToMain({ type: "info_update", data: e });
    try {
      const mi = e?.info?.match_info || {};
      const inMatch = Boolean(mi?.round_phase) || Number(mi?.round_number) > 0;
      if (inMatch) {
        if (!overlaySuppressed) { showMain(); }
      } else {
        hideMain();
      }
    } catch {}
  });
}

function tryInitForValorant() {
  overwolf.games.getRunningGameInfo((info: any) => {
    if (isValorant(info)) {
      valorantActive = true;
      setFeatures();
      initListeners();
      forwardToMain({ type: "game_detected", data: info });
      if (!overlaySuppressed) { showMain(); }
      hideDesktop();
    } else {
      valorantActive = false;
      forwardToMain({ type: "no_game" });
      showDesktop();
    }
  });
}

overwolf.games.onGameInfoUpdated.addListener((e: any) => {
  const gameInfo = e && e.gameInfo;
  if (isValorant(gameInfo)) {
    valorantActive = true;
    setFeatures();
    initListeners();
    forwardToMain({ type: "game_detected", data: gameInfo });
    if (!overlaySuppressed) { showMain(); }
    hideDesktop();
  } else {
    valorantActive = false;
    hideMain();
    showDesktop();
    forwardToMain({ type: "no_game" });
  }
});

try {
  overwolf.settings.hotkeys.onPressed.addListener((e: any) => {
    forwardToMain({ type: 'hotkey_pressed', data: { name: e?.name } })
    if (e && e.name === 'toggle_app') toggleMain();
    if (e && e.name === 'toggle_desktop') {
      if (!valorantActive) {
        toggleDesktop();
      } else {
        forwardToMain({ type: 'ignored_toggle_desktop_in_game' })
      }
    }
    if (e && e.name === 'voice_command') {
      try { showMain() } catch {}
      forwardToMain({ type: 'voice_command' });
    }
    if (e && e.name === 'toggle_settings') {
      try { showMain() } catch {}
      forwardToMain({ type: 'toggle_settings' });
    }
  });
} catch {}

try {
  overwolf.settings.hotkeys.onChanged.addListener((e: any) => {
    try {
      const name = e?.name
      const binding = e?.binding || e?.hotkey
      forwardToMain({ type: 'hotkey_changed', data: { name, binding } })
      checkHotkeyConflicts()
    } catch {}
  })
} catch {}

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
} catch {}

try { ensureOverlayEnabled(); checkHotkeyConflicts(); checkHotkeysAssigned() } catch {}

tryInitForValorant();
