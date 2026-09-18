import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createStateObservable,
  deploy,
  join,
  ledger,
  commitMessage,
  revealMessage,
  decodeMessage,
  Phase,
  PRIVATE_STATE_ID,
  type ContractState,
} from "hello-world-local-api";
import { useMidnightProviders } from "@/providers/midnight-providers";
import { useContractState } from "@/hooks/use-contract-state";

const CONTRACT_ADDRESS_STORAGE_KEY = "hello-world-local_contract_address";

export type CircuitCallStatus =
  | "idle"
  | "pending"
  | "submitted"
  | "success"
  | "error";

export interface UseHelloWorldResult {
  /** The contract address this browser is currently attached to, if any. */
  contractAddress: string | null;
  /** True while a deploy/join call is in flight. */
  isConnecting: boolean;
  /** Deploys a brand-new instance of the hello-world contract. */
  deployNew: () => Promise<void>;
  /** Attaches to an existing deployed instance by address. */
  joinExisting: (address: string) => Promise<void>;
  /** Forgets the current contract (does not affect on-chain state). */
  leave: () => void;

  /** The contract's public ledger state, live via the indexer. */
  ledgerState: ContractState | null;
  /** Error surfaced by the ledger-state subscription, if any. */
  ledgerError: Error | null;

  /** Locally revealed message history for this browser (private state). */
  messageHistory: readonly string[];

  /** Stages `message` locally and calls commitMessage() — only a commitment hash reaches the chain. */
  commit: (message: string) => Promise<void>;
  /** Calls revealMessage(), which discloses the message only if it matches the earlier commitment. */
  reveal: () => Promise<void>;
  callStatus: CircuitCallStatus;
  callError: string | null;
}

/**
 * Encapsulates the full lifecycle for the hello-world commit/reveal contract:
 * connecting (deploy or join), subscribing to the live public ledger state,
 * committing a secret message, and revealing it once ready.
 */
export function useHelloWorld(): UseHelloWorldResult {
  const { providers, isReady } = useMidnightProviders();

  const [contractAddress, setContractAddress] = useState<string | null>(
    () => window.localStorage.getItem(CONTRACT_ADDRESS_STORAGE_KEY),
  );
  const [isConnecting, setIsConnecting] = useState(false);

  const [messageHistory, setMessageHistory] = useState<readonly string[]>([]);
  const [callStatus, setCallStatus] = useState<CircuitCallStatus>("idle");
  const [callError, setCallError] = useState<string | null>(null);

  const refreshMessageHistory = useCallback(async () => {
    if (!providers) return;
    const state = await providers.privateStateProvider.get(PRIVATE_STATE_ID);
    setMessageHistory(state?.messageHistory ?? []);
  }, [providers]);

  useEffect(() => {
    refreshMessageHistory();
  }, [refreshMessageHistory]);

  const stateObservable = useMemo(() => {
    if (!providers || !contractAddress) return null;
    return createStateObservable(
      providers.publicDataProvider,
      providers.privateStateProvider,
      contractAddress,
      ledger,
    );
  }, [providers, contractAddress]);

  const { state: derivedState, error: ledgerError } =
    useContractState(stateObservable);

  const deployNew = useCallback(async () => {
    if (!providers) throw new Error("Providers are not ready yet.");
    setIsConnecting(true);
    setCallError(null);
    try {
      const deployed = await deploy(providers);
      const address = deployed.deployTxData.public.contractAddress;
      window.localStorage.setItem(CONTRACT_ADDRESS_STORAGE_KEY, address);
      setContractAddress(address);
    } finally {
      setIsConnecting(false);
    }
  }, [providers]);

  const joinExisting = useCallback(
    async (address: string) => {
      if (!providers) throw new Error("Providers are not ready yet.");
      setIsConnecting(true);
      setCallError(null);
      try {
        await join(providers, address);
        window.localStorage.setItem(CONTRACT_ADDRESS_STORAGE_KEY, address);
        setContractAddress(address);
      } finally {
        setIsConnecting(false);
      }
    },
    [providers],
  );

  const leave = useCallback(() => {
    window.localStorage.removeItem(CONTRACT_ADDRESS_STORAGE_KEY);
    setContractAddress(null);
    setCallStatus("idle");
    setCallError(null);
  }, []);

  const commit = useCallback(
    async (message: string) => {
      if (!providers || !contractAddress) {
        throw new Error("Not attached to a contract yet.");
      }
      setCallStatus("pending");
      setCallError(null);
      try {
        await commitMessage(providers, contractAddress, message);
        setCallStatus("submitted");
        setCallStatus("success");
      } catch (err) {
        setCallStatus("error");
        setCallError(err instanceof Error ? err.message : String(err));
        throw err;
      }
    },
    [providers, contractAddress],
  );

  const reveal = useCallback(async () => {
    if (!providers || !contractAddress) {
      throw new Error("Not attached to a contract yet.");
    }
    setCallStatus("pending");
    setCallError(null);
    try {
      await revealMessage(providers, contractAddress);
      setCallStatus("submitted");
      await refreshMessageHistory();
      setCallStatus("success");
    } catch (err) {
      setCallStatus("error");
      setCallError(err instanceof Error ? err.message : String(err));
      throw err;
    }
  }, [providers, contractAddress, refreshMessageHistory]);

  // If the wallet/providers disconnect, drop the live subscription's error
  // state so a stale error doesn't linger once we reconnect.
  useEffect(() => {
    if (!isReady) {
      setCallStatus("idle");
      setCallError(null);
    }
  }, [isReady]);

  return {
    contractAddress,
    isConnecting,
    deployNew,
    joinExisting,
    leave,
    ledgerState: derivedState?.contractState ?? null,
    ledgerError,
    messageHistory,
    commit,
    reveal,
    callStatus,
    callError,
  };
}

export { Phase, decodeMessage };
