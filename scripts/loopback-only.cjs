/**
 * Preîncărcat în procesul Remotion Studio (NODE_OPTIONS=--require): serverele care ar asculta pe toate
 * interfețele de rețea („0.0.0.0”, „::” sau fără adresă) ascultă doar pe 127.0.0.1. Remotion Studio nu are o
 * opțiune pentru asta, iar fără ea ar fi accesibil din rețeaua locală cât rulează.
 * Socket-urile locale (IPC, căi de fișier) și adresele alese explicit rămân neschimbate.
 */
const net = require("node:net");

const ANY = new Set([undefined, null, "", "0.0.0.0", "::"]);
const LOOPBACK = "127.0.0.1";
const listen = net.Server.prototype.listen;

net.Server.prototype.listen = function (...args) {
  const first = args[0];
  if (first && typeof first === "object" && !Array.isArray(first)) {
    // listen({ port, host }) – nu și listen({ path }) sau listen(handle)
    if (first.path === undefined && first.handle === undefined && first.fd === undefined && ANY.has(first.host)) args[0] = { ...first, host: LOOPBACK };
  } else if (typeof first === "number" || (typeof first === "string" && /^\d+$/.test(first))) {
    // listen(port[, host][, backlog][, callback])
    if (typeof args[1] === "string") {
      if (ANY.has(args[1])) args[1] = LOOPBACK;
    } else args.splice(1, 0, LOOPBACK);
  } else if (first === undefined || typeof first === "function") {
    // listen() / listen(callback): port ales de sistem
    args.unshift(0, LOOPBACK);
  }
  return listen.apply(this, args);
};
