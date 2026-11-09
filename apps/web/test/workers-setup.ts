import { AsyncLocalStorage } from "node:async_hooks";

// Vitest 5's mocker calls AsyncLocalStorage#disable() once vi.mock factories
// settle, purely to stop an enabled store slowing promises on Node. workerd
// deliberately omits disable() and throws, which fails every worker suite that
// uses vi.mock. A no-op is safe: the next run() still sets the store.
AsyncLocalStorage.prototype.disable = () => {};
