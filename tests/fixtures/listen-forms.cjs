// Pornește servere cu toate formele de listen și afișează adresa pe care ascultă fiecare (testul preload-ului loopback-only).
const net = require("node:net");
const http = require("node:http");
const out = [];
const done = () => {
  if (out.length === 5) {
    console.log(JSON.stringify(out));
    process.exit(0);
  }
};
const s1 = net.createServer();
s1.listen(0, () => {
  out.push(["port", s1.address().address]);
  s1.close();
  done();
});
const s2 = net.createServer();
s2.listen({ port: 0, host: "::" }, () => {
  out.push(["obj ::", s2.address().address]);
  s2.close();
  done();
});
const s3 = http.createServer();
s3.listen(0, "0.0.0.0", () => {
  out.push(["0.0.0.0", s3.address().address]);
  s3.close();
  done();
});
const s4 = net.createServer();
s4.listen(() => {
  out.push(["fără argumente", s4.address().address]);
  s4.close();
  done();
});
const s5 = net.createServer();
s5.listen({ port: 0, host: "127.0.0.1" }, () => {
  out.push(["explicit", s5.address().address]);
  s5.close();
  done();
});
