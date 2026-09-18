import type { PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";
import type { ContractAddress, SigningKey } from "@midnight-ntwrk/compact-runtime";

/**
 * Session-scoped, in-memory implementation of the full PrivateStateProvider
 * interface. Browser DApps cannot use LevelDB, so private state and signing
 * keys live in plain Maps for the lifetime of the page.
 *
 * This implements the complete 13-method PrivateStateProvider<PSI, PS>
 * contract. The export/import methods are not meaningful for an ephemeral
 * in-memory store, so they reject — swap in an encrypting persistent provider
 * (e.g. IndexedDB) if you need cross-session private state or real exports.
 */
export function inMemoryPrivateStateProvider<
  PSI extends string,
  PS,
>(): PrivateStateProvider<PSI, PS> {
  const states = new Map<PSI, PS>();
  const signingKeys = new Map<ContractAddress, SigningKey>();

  return {
    // Contract-address scoping is a no-op for this flat in-memory store; the
    // private state IDs are already unique within a single browser session.
    setContractAddress: (_address: ContractAddress) => {},

    set: async (id: PSI, state: PS) => {
      states.set(id, state);
    },
    get: async (id: PSI) => states.get(id) ?? null,
    remove: async (id: PSI) => {
      states.delete(id);
    },
    clear: async () => {
      states.clear();
    },

    setSigningKey: async (address: ContractAddress, signingKey: SigningKey) => {
      signingKeys.set(address, signingKey);
    },
    getSigningKey: async (address: ContractAddress) =>
      signingKeys.get(address) ?? null,
    removeSigningKey: async (address: ContractAddress) => {
      signingKeys.delete(address);
    },
    clearSigningKeys: async () => {
      signingKeys.clear();
    },

    exportPrivateStates: async () => {
      throw new Error(
        "inMemoryPrivateStateProvider does not support exportPrivateStates; " +
          "use a persistent encrypting provider for exports.",
      );
    },
    importPrivateStates: async () => {
      throw new Error(
        "inMemoryPrivateStateProvider does not support importPrivateStates; " +
          "use a persistent encrypting provider for imports.",
      );
    },
    exportSigningKeys: async () => {
      throw new Error(
        "inMemoryPrivateStateProvider does not support exportSigningKeys; " +
          "use a persistent encrypting provider for exports.",
      );
    },
    importSigningKeys: async () => {
      throw new Error(
        "inMemoryPrivateStateProvider does not support importSigningKeys; " +
          "use a persistent encrypting provider for imports.",
      );
    },
  };
}

/**
 * Browser-persistent implementation of PrivateStateProvider, backed by
 * `window.localStorage`. Unlike {@link inMemoryPrivateStateProvider}, state
 * written here survives page reloads and browser restarts (until the user
 * clears site data), which is what "local private state" means for a
 * browser DApp — the analogue of the Node-side `levelPrivateStateProvider`
 * used by the CLI/tests in ../../src/providers.ts.
 *
 * Signing keys (already plain hex strings) are stored as-is; private states
 * are JSON-serialized. Both are namespaced under `keyPrefix` so multiple
 * contracts/environments sharing an origin do not collide.
 *
 * This is a plain, unencrypted local store: adequate for a hackathon-style
 * demo (local message history, no real secrets), not a substitute for a
 * hardened, encrypting provider in a production wallet.
 */
export function localStoragePrivateStateProvider<
  PSI extends string,
  PS,
>(keyPrefix = "midnight-private-state"): PrivateStateProvider<PSI, PS> {
  const stateKey = (id: PSI) => `${keyPrefix}:state:${id}`;
  const signingKeyKey = (address: ContractAddress) =>
    `${keyPrefix}:signing-key:${address}`;

  function readJson<T>(key: string): T | null {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  function keysWithPrefix(prefix: string): string[] {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  }

  return {
    // Contract-address scoping is a no-op here too; private state IDs are
    // already namespaced per-contract by the caller (see PRIVATE_STATE_ID).
    setContractAddress: (_address: ContractAddress) => {},

    set: async (id: PSI, state: PS) => {
      window.localStorage.setItem(stateKey(id), JSON.stringify(state));
    },
    get: async (id: PSI) => readJson<PS>(stateKey(id)),
    remove: async (id: PSI) => {
      window.localStorage.removeItem(stateKey(id));
    },
    clear: async () => {
      for (const key of keysWithPrefix(`${keyPrefix}:state:`)) {
        window.localStorage.removeItem(key);
      }
    },

    setSigningKey: async (address: ContractAddress, signingKey: SigningKey) => {
      // SigningKey is a plain (hex-encoded) string, so no extra encoding
      // is needed to store it as a localStorage value.
      window.localStorage.setItem(signingKeyKey(address), signingKey);
    },
    getSigningKey: async (address: ContractAddress) =>
      window.localStorage.getItem(signingKeyKey(address)),
    removeSigningKey: async (address: ContractAddress) => {
      window.localStorage.removeItem(signingKeyKey(address));
    },
    clearSigningKeys: async () => {
      for (const key of keysWithPrefix(`${keyPrefix}:signing-key:`)) {
        window.localStorage.removeItem(key);
      }
    },

    exportPrivateStates: async () => {
      throw new Error(
        "localStoragePrivateStateProvider does not support exportPrivateStates; " +
          "use an encrypting provider for exports.",
      );
    },
    importPrivateStates: async () => {
      throw new Error(
        "localStoragePrivateStateProvider does not support importPrivateStates; " +
          "use an encrypting provider for imports.",
      );
    },
    exportSigningKeys: async () => {
      throw new Error(
        "localStoragePrivateStateProvider does not support exportSigningKeys; " +
          "use an encrypting provider for exports.",
      );
    },
    importSigningKeys: async () => {
      throw new Error(
        "localStoragePrivateStateProvider does not support importSigningKeys; " +
          "use an encrypting provider for imports.",
      );
    },
  };
}
