import { WalletProvider } from "@/providers/wallet-context";
import { MidnightProvidersProvider } from "@/providers/midnight-providers";
import { WalletWidget } from "@/components/wallet-widget";
import { NetworkBadge } from "@/components/network-badge";
import { ProofServerStatus } from "@/components/proof-server-status";
import { HelloWorldPanel } from "@/components/hello-world-panel";

export function App() {
  return (
    <WalletProvider>
      <MidnightProvidersProvider>
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto flex items-center justify-between px-4 py-3">
              <h1 className="text-lg font-semibold">hello-world-local</h1>
              <div className="flex items-center gap-3">
                <NetworkBadge />
                <ProofServerStatus />
                <WalletWidget />
              </div>
            </div>
          </header>
          <main className="container mx-auto max-w-2xl px-4 py-8">
            <HelloWorldPanel />
          </main>
        </div>
      </MidnightProvidersProvider>
    </WalletProvider>
  );
}
