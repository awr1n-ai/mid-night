import { CompiledContract } from '@midnight-ntwrk/midnight-js-protocol/compact-js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export {
  Contract,
  ledger,
  pureCircuits,
  Phase,
  type Ledger,
  type ImpureCircuits,
  type PureCircuits,
  type Witnesses,
} from './managed/hello-world/contract/index.js';
import { Contract } from './managed/hello-world/contract/index.js';

export {
  witnesses,
  emptyPrivateState,
  encodeMessage,
  decodeMessage,
  withPendingMessage,
  withRevealedMessage,
  type PrivateState,
} from './private-state.js';
import { witnesses } from './private-state.js';

// `new URL(import.meta.url).pathname` yields `/C:/...` on Windows, which
// path.resolve() mangles into `C:\C:\...` — fileURLToPath() handles the
// platform-specific conversion correctly on both POSIX and Windows.
const currentDir = path.dirname(fileURLToPath(import.meta.url));
export const zkConfigPath = path.resolve(currentDir, 'managed', 'hello-world');

export const CompiledHelloWorldContract = CompiledContract.make(
  'HelloWorldContract',
  Contract,
).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(zkConfigPath),
);
