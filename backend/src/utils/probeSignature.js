import { createHmac } from "node:crypto";

export const signProbeRequest = ({
  secret,
  timestamp,
  nonce,
  method,
  path,
  bodyText,
}) =>
  createHmac("sha256", secret)
    .update(
      `${timestamp}\n${nonce}\n${method.toUpperCase()}\n${path}\n${bodyText}`,
    )
    .digest("hex");
