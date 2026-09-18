import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useMidnightProviders } from "@/providers/midnight-providers";
import {
  useHelloWorld,
  Phase,
  decodeMessage,
  type UseHelloWorldResult,
} from "@/hooks/use-hello-world";

const MAX_MESSAGE_BYTES = 32;

const inputClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function messageByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function phaseLabel(phase: Phase): string {
  switch (phase) {
    case Phase.Empty:
      return "Empty — no commitment yet";
    case Phase.Committed:
      return "Committed — message hidden";
    case Phase.Revealed:
      return "Revealed — message public";
    default:
      return "Unknown";
  }
}

function ConnectContractForm({
  hw,
}: {
  hw: Pick<UseHelloWorldResult, "deployNew" | "joinExisting" | "isConnecting">;
}) {
  const { deployNew, joinExisting, isConnecting } = hw;
  const [joinAddress, setJoinAddress] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDeploy() {
    setError(null);
    try {
      await deployNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to deploy contract");
    }
  }

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    if (!joinAddress.trim()) return;
    setError(null);
    try {
      await joinExisting(joinAddress.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join contract");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Button onClick={handleDeploy} disabled={isConnecting}>
          {isConnecting && <Loader2 className="animate-spin" />}
          Deploy a new hello-world contract
        </Button>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        or
        <div className="h-px flex-1 bg-border" />
      </div>
      <form onSubmit={handleJoin} className="flex gap-2">
        <input
          className={inputClass}
          placeholder="Existing contract address (0x...)"
          value={joinAddress}
          onChange={(e) => setJoinAddress(e.target.value)}
          disabled={isConnecting}
        />
        <Button type="submit" variant="outline" disabled={isConnecting}>
          Join
        </Button>
      </form>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function truncateAddress(address: string): string {
  if (address.length <= 20) return address;
  return `${address.slice(0, 10)}...${address.slice(-8)}`;
}

function CallStatusBadge({
  status,
}: {
  status: "idle" | "pending" | "submitted" | "success" | "error";
}) {
  if (status === "idle") return null;
  const variant =
    status === "error"
      ? "destructive"
      : status === "success"
        ? "secondary"
        : "outline";
  const label =
    status === "pending"
      ? "Proving & submitting..."
      : status === "submitted"
        ? "Confirming..."
        : status === "success"
          ? "Confirmed"
          : "Failed";
  return <Badge variant={variant}>{label}</Badge>;
}

function CommitForm({
  hw,
}: {
  hw: Pick<UseHelloWorldResult, "commit" | "callStatus" | "callError">;
}) {
  const { commit, callStatus, callError } = hw;
  const [draft, setDraft] = useState("");
  const byteLength = messageByteLength(draft);
  const tooLong = byteLength > MAX_MESSAGE_BYTES;
  const busy = callStatus === "pending" || callStatus === "submitted";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim() || tooLong) return;
    try {
      await commit(draft.trim());
      setDraft("");
    } catch {
      // callError is already surfaced via useHelloWorld's state.
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label className="text-sm font-medium" htmlFor="secret-message">
        Commit a secret message
      </label>
      <div className="flex gap-2">
        <input
          id="secret-message"
          className={inputClass}
          placeholder="Type a secret message..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={busy}
        />
        <Button type="submit" disabled={!draft.trim() || tooLong || busy}>
          {busy && <Loader2 className="animate-spin" />}
          Commit
        </Button>
      </div>
      <p
        className={`text-xs ${tooLong ? "text-destructive" : "text-muted-foreground"}`}
      >
        {byteLength}/{MAX_MESSAGE_BYTES} bytes — only a commitment hash is
        published, never the message itself.
      </p>
      <div className="flex items-center gap-2">
        <CallStatusBadge status={callStatus} />
        {callStatus === "error" && callError && (
          <p className="text-sm text-destructive">{callError}</p>
        )}
      </div>
    </form>
  );
}

function RevealAction({
  hw,
}: {
  hw: Pick<UseHelloWorldResult, "reveal" | "callStatus" | "callError">;
}) {
  const { reveal, callStatus, callError } = hw;
  const busy = callStatus === "pending" || callStatus === "submitted";

  async function handleReveal() {
    try {
      await reveal();
    } catch {
      // callError is already surfaced via useHelloWorld's state.
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed p-4">
      <p className="text-sm text-muted-foreground">
        A message is committed but not yet revealed. The chain only shows the
        commitment hash below — revealing proves the message matches it.
      </p>
      <Button onClick={handleReveal} disabled={busy}>
        {busy && <Loader2 className="animate-spin" />}
        Reveal committed message
      </Button>
      <div className="flex items-center gap-2">
        <CallStatusBadge status={callStatus} />
        {callStatus === "error" && callError && (
          <p className="text-sm text-destructive">{callError}</p>
        )}
      </div>
    </div>
  );
}

function ConnectedContract({ hw }: { hw: UseHelloWorldResult }) {
  const { contractAddress, leave, ledgerState, ledgerError, messageHistory } =
    hw;

  const phase = ledgerState?.phase;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Contract address</p>
          <p className="font-mono text-sm" title={contractAddress ?? ""}>
            {contractAddress ? truncateAddress(contractAddress) : ""}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={leave}>
          Disconnect
        </Button>
      </div>

      <div className="rounded-lg border bg-muted/30 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            On-chain state
          </p>
          <Badge variant="outline">Round {ledgerState?.round.toString() ?? "0"}</Badge>
        </div>
        {ledgerState ? (
          <>
            <p className="text-sm font-medium">{phaseLabel(ledgerState.phase)}</p>
            <p className="text-xs text-muted-foreground">Commitment (public)</p>
            <p className="break-all font-mono text-xs">
              {toHex(ledgerState.commitment)}
            </p>
            {ledgerState.phase === Phase.Revealed && (
              <>
                <p className="text-xs text-muted-foreground">Revealed message</p>
                <p className="text-sm font-medium">
                  "{decodeMessage(ledgerState.revealedMessage)}"
                </p>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading...</p>
        )}
        {ledgerError && (
          <p className="text-sm text-destructive">{ledgerError.message}</p>
        )}
      </div>

      {phase === Phase.Committed ? (
        <RevealAction hw={hw} />
      ) : (
        <CommitForm hw={hw} />
      )}

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Locally revealed messages (private state, this browser only)
        </p>
        {messageHistory.length === 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing revealed from this browser yet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {messageHistory
              .slice()
              .reverse()
              .map((message, index) => (
                <li
                  key={`${messageHistory.length - index}-${message}`}
                  className="rounded-md border bg-background px-3 py-1.5 text-sm"
                >
                  {message}
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function HelloWorldPanel() {
  const { isReady, error } = useMidnightProviders();
  const hw = useHelloWorld();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hello World contract</CardTitle>
        <CardDescription>
          Deploy a fresh instance or join one that's already on-chain, then
          commit a secret message and reveal it once you're ready.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!isReady ? (
          <p className="text-sm text-muted-foreground">
            {error
              ? `Providers failed to initialize: ${error}`
              : "Connect your wallet above to interact with the contract."}
          </p>
        ) : hw.contractAddress ? (
          <ConnectedContract hw={hw} />
        ) : (
          <ConnectContractForm hw={hw} />
        )}
      </CardContent>
      <CardFooter>
        <p className="text-xs text-muted-foreground">
          Privacy claim: committing writes only a 32-byte commitment hash
          on-chain — the message and its salt never leave this browser until
          you choose to reveal. Revealing then proves, in zero knowledge,
          that the disclosed message matches that earlier commitment.
        </p>
      </CardFooter>
    </Card>
  );
}
