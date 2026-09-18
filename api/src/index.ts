import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { indexerPublicDataProvider } from "@midnight-ntwrk/midnight-js-indexer-public-data-provider";
import { FetchZkConfigProvider } from "@midnight-ntwrk/midnight-js-fetch-zk-config-provider";
import { httpClientProofProvider } from "@midnight-ntwrk/midnight-js-http-client-proof-provider";
import { toHex, fromHex } from "@midnight-ntwrk/midnight-js-utils";
import {
  Transaction,
  type FinalizedTransaction,
} from "@midnight-ntwrk/ledger-v8";
import type { ChargedState } from "@midnight-ntwrk/compact-runtime";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import type {
  WalletProvider,
  MidnightProvider,
} from "@midnight-ntwrk/midnight-js-types";
import {
  deployContract,
  findDeployedContract,
  submitCallTx,
  type DeployedContract,
  type FoundContract,
} from "@midnight-ntwrk/midnight-js-contracts";
import { CompiledContract } from "@midnight-ntwrk/compact-js";
import { combineLatest, map, retry, Observable } from "rxjs";
import {
  Contract,
  ledger,
} from "hello-world-local-contract/managed/hello-world/contract/index.js";
export {
  ledger,
  Phase,
} from "hello-world-local-contract/managed/hello-world/contract/index.js";
export type { Contract } from "hello-world-local-contract/managed/hello-world/contract/index.js";
import {
  witnesses,
  emptyPrivateState,
  withPendingMessage,
  withRevealedMessage,
} from "hello-world-local-contract";
export {
  encodeMessage,
  decodeMessage,
} from "hello-world-local-contract";
import { localStoragePrivateStateProvider } from "./private-state.js";
import type {
  AppProviders,
  ContractState,
  DerivedState,
  ImpureCircuitKeys,
  PrivateState,
} from "./types.js";
import { PRIVATE_STATE_ID } from "./types.js";

export {
  inMemoryPrivateStateProvider,
  localStoragePrivateStateProvider,
} from "./private-state.js";
export type {
  AppProviders,
  ContractState,
  DerivedState,
  ImpureCircuitKeys,
  PrivateState,
} from "./types.js";
export { PRIVATE_STATE_ID } from "./types.js";

function deriveProofServerUri(substrateNodeUri: string): string {
  try {
    const url = new URL(substrateNodeUri);
    url.port = "6300";
    url.pathname = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "http://localhost:6300";
  }
}

export async function createProviders(
  api: ConnectedAPI,
): Promise<AppProviders> {
  const config = await api.getConfiguration();
  setNetworkId(config.networkId);

  const publicDataProvider = indexerPublicDataProvider(
    config.indexerUri,
    config.indexerWsUri,
  );

  // localStorage-backed: the hello-world contract's local message history
  // (see PrivateState in ./types.ts) survives page reloads for as long as
  // the browser keeps this origin's site data.
  const privateStateProvider = localStoragePrivateStateProvider<
    typeof PRIVATE_STATE_ID,
    PrivateState
  >();

  const zkConfigProvider = new FetchZkConfigProvider<ImpureCircuitKeys>(
    window.location.origin,
    fetch.bind(window),
  );

  const proofServerUri = deriveProofServerUri(config.substrateNodeUri);
  const proofProvider = httpClientProofProvider<ImpureCircuitKeys>(
    proofServerUri,
    zkConfigProvider,
  );

  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } =
    await api.getShieldedAddresses();

  const walletProvider: WalletProvider = {
    getCoinPublicKey: () => shieldedCoinPublicKey,
    getEncryptionPublicKey: () => shieldedEncryptionPublicKey,
    // WalletProvider.balanceTx is (tx: UnboundTransaction, ttl?: Date) =>
    // Promise<FinalizedTransaction>. The DApp Connector speaks serialized hex
    // strings, so we hex-encode the unbound tx, hand it to Lace (which selects
    // fee inputs/change and binds it), then deserialize the returned hex string
    // back into a FinalizedTransaction. The options object is `{ payFees?:
    // boolean }`; an empty `{}` uses the defaults (payFees: true). There is no
    // `sender`, `newCoins`, or `ttl` argument on this method.
    balanceTx: async (tx, _ttl) => {
      const { tx: balancedHex } = await api.balanceUnsealedTransaction(
        toHex(tx.serialize()),
        {},
      );
      // A balanced/finalized tx is Transaction<SignatureEnabled, Proof, Binding>.
      // deserialize takes the three instance markers for those type params.
      return Transaction.deserialize(
        "signature",
        "proof",
        "binding",
        fromHex(balancedHex),
      ) satisfies FinalizedTransaction;
    },
  };

  const midnightProvider: MidnightProvider = {
    submitTx: async (tx) => {
      // submitTransaction takes a serialized hex string and returns void; the
      // tx id is recovered from the transaction's own identifiers().
      await api.submitTransaction(toHex(tx.serialize()));
      return tx.identifiers()[0];
    },
  };

  return {
    privateStateProvider,
    publicDataProvider,
    zkConfigProvider,
    proofProvider,
    walletProvider,
    midnightProvider,
  };
}

// The hello-world contract's on-chain identity, as reported by verifier-key
// checks (`deployContract`/`findDeployedContract` embed this tag).
const CONTRACT_TAG = "HelloWorldContract";

// `withCompiledFileAssets(path)` takes a *path string*, resolved relative to
// each consuming service's base path — not a URL. Here it tells the
// FetchZkConfigProvider (built with base `window.location.origin` above)
// where to fetch `keys/storeMessage.{prover,verifier}` and
// `zkir/storeMessage.{zkir,bzkir}` from at proving time: this path must
// match wherever the UI serves the compiled contract's managed output as
// static assets (see ui/package.json's `copy-contract-keys` script, which
// copies contracts/managed/hello-world into ui/public/managed/hello-world).
const CONTRACT_ASSETS_PATH = "managed/hello-world";

// `secretMessage`/`secretSalt` (see contracts/private-state.ts) back the
// commit/reveal circuits; `withWitnesses` mirrors contracts/index.ts, which
// builds the equivalent Node-side binding for the CLI/tests.
export const compiledHelloWorldContract = CompiledContract.make(
  CONTRACT_TAG,
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(CONTRACT_ASSETS_PATH),
);

/** Deploys a fresh instance of the hello-world contract. */
export async function deploy(
  providers: AppProviders,
): Promise<DeployedContract<Contract>> {
  return deployContract<Contract>(providers, {
    compiledContract: compiledHelloWorldContract,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState,
  });
}

/** Attaches to a previously deployed instance of the hello-world contract. */
export async function join(
  providers: AppProviders,
  contractAddress: string,
): Promise<FoundContract<Contract>> {
  return findDeployedContract<Contract>(providers, {
    compiledContract: compiledHelloWorldContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    initialPrivateState: emptyPrivateState,
  });
}

/**
 * Stages `newMessage` (+ a fresh random salt) in this browser's private
 * state, then calls `commitMessage`. Only the resulting commitment hash
 * reaches the chain — the message and salt stay local.
 */
export async function commitMessage(
  providers: AppProviders,
  contractAddress: string,
  newMessage: string,
) {
  const current =
    (await providers.privateStateProvider.get(PRIVATE_STATE_ID)) ??
    emptyPrivateState;
  await providers.privateStateProvider.set(
    PRIVATE_STATE_ID,
    withPendingMessage(current, newMessage),
  );

  return submitCallTx<Contract, "commitMessage">(providers, {
    compiledContract: compiledHelloWorldContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    circuitId: "commitMessage",
  });
}

/**
 * Calls `revealMessage`, which re-derives the commitment from the same
 * staged message + salt and discloses the message only if it matches.
 * On success, archives the message into this browser's local history and
 * clears the pending slot.
 */
export async function revealMessage(
  providers: AppProviders,
  contractAddress: string,
) {
  const result = await submitCallTx<Contract, "revealMessage">(providers, {
    compiledContract: compiledHelloWorldContract,
    contractAddress,
    privateStateId: PRIVATE_STATE_ID,
    circuitId: "revealMessage",
  });

  const current =
    (await providers.privateStateProvider.get(PRIVATE_STATE_ID)) ??
    emptyPrivateState;
  await providers.privateStateProvider.set(
    PRIVATE_STATE_ID,
    withRevealedMessage(current),
  );

  return result;
}

export function createStateObservable(
  publicDataProvider: AppProviders["publicDataProvider"],
  privateStateProvider: AppProviders["privateStateProvider"],
  contractAddress: string,
  // `state.data` is now a ChargedState (not a Uint8Array). Your compiled
  // contract's generated `YourContract.ledger(state.data)` accepts this value.
  parseLedger: (data: ChargedState) => ContractState,
): Observable<DerivedState> {
  const public$ = publicDataProvider
    .contractStateObservable(contractAddress, { type: "latest" })
    .pipe(map((state) => parseLedger(state.data)));

  const private$ = new Observable<PrivateState | null>((subscriber) => {
    privateStateProvider
      .get(PRIVATE_STATE_ID)
      .then((s) => subscriber.next(s))
      .catch((err) => subscriber.error(err));
  });

  return combineLatest([public$, private$]).pipe(
    map(([contractState, privateState]) => ({ contractState, privateState })),
    retry({ delay: 500 }),
  );
}
