import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import type { Ledger } from "hello-world-local-contract/managed/hello-world/contract/index.js";
import type { PrivateState } from "hello-world-local-contract";

/**
 * ContractState — the shape of the hello-world contract's public ledger
 *   state, parsed from the indexer via `ledger(state.data)`: `phase`,
 *   `commitment` (Bytes<32>), `revealedMessage` (Bytes<32>, only meaningful
 *   once `phase === Phase.Revealed`), and `round`.
 *
 * PrivateState — defined in the contracts package alongside the witness
 *   implementations (`secretMessage`/`secretSalt`) that back it: the
 *   message + salt staged for the current commit/reveal cycle, plus a
 *   local, never-disclosed history of revealed messages.
 *
 * DerivedState — the combined view your UI components consume, computed
 *   from ContractState + PrivateState.
 */

// The hello-world contract exposes two impure circuits.
export type ImpureCircuitKeys = "commitMessage" | "revealMessage";

// Identifier under which this browser's local private state is stored.
export const PRIVATE_STATE_ID = "helloWorldPrivateState" as const;

// The hello-world contract's public ledger state.
export type ContractState = Ledger;

export type { PrivateState } from "hello-world-local-contract";

// Combined state for UI consumption
export interface DerivedState {
  contractState: ContractState | null;
  privateState: PrivateState | null;
}

export type AppProviders = MidnightProviders<
  ImpureCircuitKeys,
  typeof PRIVATE_STATE_ID,
  PrivateState
>;
