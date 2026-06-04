import pino from "pino";
import { AsyncLocalStorage } from "async_hooks";

export const requestContext = new AsyncLocalStorage<string>();

const baseLogger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const logger = new Proxy(baseLogger, {
  get(target, prop, receiver) {
    const origMethod = target[prop as keyof typeof baseLogger];
    if (typeof origMethod === "function") {
      return function (...args: any[]) {
        const reqId = requestContext.getStore();
        if (reqId) {
          if (typeof args[0] === "object" && args[0] !== null && !Array.isArray(args[0])) {
            args[0] = { requestId: reqId, ...args[0] };
          } else {
            args.unshift({ requestId: reqId });
          }
        }
        return (origMethod as Function).apply(target, args);
      };
    }
    return Reflect.get(target, prop, receiver);
  },
});
