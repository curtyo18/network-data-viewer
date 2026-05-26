import { vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { RenderOptions, RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { STORAGE_KEY } from "@/shared/messages";

// Auto-cleanup rendered components after each test (works alongside explicit unmount calls).
afterEach(() => { cleanup(); });


// ---------------------------------------------------------------------------
// In-memory chrome.storage.local stub that fires onChanged listeners
// ---------------------------------------------------------------------------

type ChangeListenerFn = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

function buildChromeStub() {
  let state: Record<string, unknown> = {};
  const listeners: Set<ChangeListenerFn> = new Set();

  function fire(key: string, oldValue: unknown, newValue: unknown) {
    const changes: Record<string, chrome.storage.StorageChange> = {
      [key]: { oldValue, newValue } as chrome.storage.StorageChange,
    };
    for (const fn of listeners) fn(changes, "local");
  }

  const storageLocal = {
    get: vi.fn(async (k: string) => ({ [k]: state[k] })),
    set: vi.fn(async (kv: Record<string, unknown>) => {
      const old = { ...state };
      Object.assign(state, kv);
      for (const key of Object.keys(kv)) {
        fire(key, old[key], state[key]);
      }
    }),
  };

  const storageOnChanged = {
    addListener: vi.fn((fn: ChangeListenerFn) => { listeners.add(fn); }),
    removeListener: vi.fn((fn: ChangeListenerFn) => { listeners.delete(fn); }),
  };

  const runtimeSendMessage = vi.fn(async (_msg: unknown) => ({ errors: {} }));

  const clipboardWriteText = vi.fn(async (_text: string): Promise<void> => undefined);

  function reset() {
    state = {};
    listeners.clear();
    storageLocal.get.mockClear();
    storageLocal.set.mockClear();
    storageOnChanged.addListener.mockClear();
    storageOnChanged.removeListener.mockClear();
    runtimeSendMessage.mockReset();
    runtimeSendMessage.mockResolvedValue({ errors: {} });
    clipboardWriteText.mockClear();
  }

  function setStored(key: string, value: unknown) {
    state[key] = value;
  }

  function getStored(key: string): unknown {
    return state[key];
  }

  function install() {
    (globalThis as unknown as { chrome: unknown }).chrome = {
      storage: {
        local: storageLocal as unknown as chrome.storage.LocalStorageArea,
        onChanged: storageOnChanged as unknown as chrome.storage.StorageChangedEvent,
      },
      runtime: {
        sendMessage: runtimeSendMessage,
      } as unknown as typeof chrome.runtime,
    };
    // Patch navigator.clipboard.writeText on the Clipboard prototype.
    // happy-dom exposes a real Clipboard object; writeText is on its prototype.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clipboardProto = Object.getPrototypeOf(globalThis.navigator.clipboard) as any;
    Object.defineProperty(clipboardProto, "writeText", {
      value: clipboardWriteText,
      writable: true,
      configurable: true,
    });
  }

  return {
    reset,
    setStored,
    getStored,
    install,
    storageLocal,
    storageOnChanged,
    runtimeSendMessage,
    clipboardWriteText,
    ANALYSER_KEY: STORAGE_KEY,
  };
}

export const chromeMock = buildChromeStub();

// Install once at module load so imports that reference chrome.storage at
// module scope (like use-analysers) see the stub.
chromeMock.install();

// ---------------------------------------------------------------------------
// Thin re-export of RTL render with nothing extra — keeps tests concise
// ---------------------------------------------------------------------------

export function renderComponent(
  ui: ReactElement,
  options?: RenderOptions,
): RenderResult {
  return render(ui, options);
}
