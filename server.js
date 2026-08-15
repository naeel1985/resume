// Production entry point for Phusion Passenger (cPanel "Setup Node.js App").
//
// cPanel runs this file directly with Node. We boot Next.js in production and
// call .listen(), which Passenger intercepts to bind the request socket it
// manages — so the PORT below only matters when running `npm start` by hand.
//
// This deliberately does NOT use Next's `standalone` output: the code is
// deployed by `git pull` + `npm install` on the server, so node_modules is
// present (symlinked into the Node virtualenv by CloudLinux) and the ordinary
// Next runtime is what we want.
const { createServer } = require("http");
const next = require("next");

const port = process.env.PORT || 3000;
const hostname = process.env.HOSTNAME || "0.0.0.0";

const app = next({ dev: false });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, () => {
      console.log(`naeel.ai-technology.ae ready on ${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start server:", err);
    process.exit(1);
  });
