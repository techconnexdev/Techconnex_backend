/**
 * In production, silence console.log/debug/info/warn so they are no-ops.
 * console.error is left enabled for debugging.
 * Must be imported after dotenv/config so NODE_ENV is set.
 */
if (process.env.NODE_ENV === "production") {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  console.info = noop;
  console.warn = noop;
}
