import type { WitnessContext } from '@midnight-ntwrk/compact-runtime';
import type { Ledger } from './managed/hello-world/contract/index.js';

// The contract's message and salt are both fixed at 32 bytes (see
// hello-world.compact — Opaque<"string"> can't be fed into persistentCommit,
// so the message is a plain Bytes<32>, UTF-8 encoded and zero-padded here).
const MESSAGE_BYTES = 32;

export interface PrivateState {
  /** The message staged for the in-flight commit/reveal cycle, if any. */
  readonly pendingMessage: Uint8Array;
  /** The random salt used to blind that message's commitment. */
  readonly pendingSalt: Uint8Array;
  /** Messages this browser/CLI has successfully revealed, newest last. */
  readonly messageHistory: readonly string[];
}

export const emptyPrivateState: PrivateState = {
  pendingMessage: new Uint8Array(MESSAGE_BYTES),
  pendingSalt: new Uint8Array(MESSAGE_BYTES),
  messageHistory: [],
};

export function encodeMessage(text: string): Uint8Array {
  const encoded = new TextEncoder().encode(text);
  if (encoded.length > MESSAGE_BYTES) {
    throw new Error(
      `Message too long: max ${MESSAGE_BYTES} UTF-8 bytes, got ${encoded.length}`,
    );
  }
  const bytes = new Uint8Array(MESSAGE_BYTES);
  bytes.set(encoded);
  return bytes;
}

export function decodeMessage(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder().decode(bytes.slice(0, end));
}

function randomSalt(): Uint8Array {
  const salt = new Uint8Array(MESSAGE_BYTES);
  globalThis.crypto.getRandomValues(salt);
  return salt;
}

/**
 * Stages a new message + fresh salt ahead of a commitMessage() call. The
 * salt must be generated here (once) rather than inside a witness, since
 * revealMessage() later needs the *same* salt to reproduce the commitment.
 */
export function withPendingMessage(
  state: PrivateState,
  message: string,
): PrivateState {
  return {
    ...state,
    pendingMessage: encodeMessage(message),
    pendingSalt: randomSalt(),
  };
}

/** After a successful revealMessage() call: archive the message, clear the pending slot. */
export function withRevealedMessage(state: PrivateState): PrivateState {
  return {
    pendingMessage: new Uint8Array(MESSAGE_BYTES),
    pendingSalt: new Uint8Array(MESSAGE_BYTES),
    messageHistory: [...state.messageHistory, decodeMessage(state.pendingMessage)],
  };
}

// Both witnesses simply hand back whatever is currently staged in private
// state — commitMessage() and revealMessage() must see the *same* message
// and salt for the commitment to verify, so neither witness may invent new
// values of its own.
export const witnesses = {
  secretMessage: ({
    privateState,
  }: WitnessContext<Ledger, PrivateState>): [PrivateState, Uint8Array] => [
    privateState,
    privateState.pendingMessage,
  ],
  secretSalt: ({
    privateState,
  }: WitnessContext<Ledger, PrivateState>): [PrivateState, Uint8Array] => [
    privateState,
    privateState.pendingSalt,
  ],
};
