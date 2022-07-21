const http = require("http");
const express = require("express");
const qrcode = require("qrcode");
const socketIO = require("socket.io");
const { unlink } = require("fs");
// baileys
const makeWASocket = require("@adiwajshing/baileys").default;
const {
  DisconnectReason,
  makeWALegacySocket,
} = require("@adiwajshing/baileys");

const port = 8000 || process.env.PORT;
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

app.use(express.json());
// app.use(express.urlencoded({
//   extended: true
// }))
app.use("/assets", express.static(__dirname + "/client/assets"));

app.get("/scan", (req, res) => {
  res.sendFile("./client/server.html", {
    root: __dirname,
  });
});

app.get("/", (req, res) => {
  res.sendFile("./client/index.html", {
    root: __dirname,
  });
});

let config = {
  printQRInTerminal: true,
  browser: ["Wabill", "Chrome", "1.1.0"],
};

let wa;
let sock;
let qr;

const startWA = async (currentVersion = "legacy") => {
  if (currentVersion === "legacy") {
    wa = makeWALegacySocket(config);
  } else {
    unlink("./auth-info-multi.json", (err) => {
      if (err && err.code == "ENOENT") {
        // file doens't exist
        console.info("File doesn't exist, won't remove it.");
      } else if (err) {
        console.error("Error occurred while trying to remove file.");
      }
    });
    wa = makeWASocket(config);
  }

  wa.ev.on("connection.update", (update) => {
    let statusCode = update.lastDisconnect?.error?.output?.statusCode;
    let msg = update.lastDisconnect?.error?.output?.payload?.message;

    console.log(update);
    // error with legacy version
    if (
      update.lastDisconnect?.error?.toString() ===
      "Error: Unexpected server response: 400"
    ) {
      // console.log("Error, please restart the app!")
      setTimeout(() => {
        startWA();
      }, 1024);
    }

    switch (statusCode) {
      case DisconnectReason.restartRequired:
        config.auth = wa.authState;
        startWA("md");
        updateQR("connected");
        break;
      case DisconnectReason.timedOut:
        console.log("QR Timeout. Trying again...");
        startWA("md");
        break;
      case DisconnectReason.multideviceMismatch:
        console.log("Hmm. Trying again...");
        if (msg === "Require multi-device edition") {
          startWA("md");
          break;
        }
        startWA();
        break;
      default:
        break;
    }

    if (update.qr) {
      qr = update.qr;
      updateQR("qr");
    } else {
      qr = undefined;
      if (update.connection === "open") {
        updateQR("connected");
        return;
      }
      updateQR("loading");
    }
  });
};

startWA();

io.on("connection", async (socket) => {
  sock = socket;

  // console.log(wa)
  if (isConnected) {
    updateQR("connected");
  } else if (qr) updateQR("qr");
});

// send text message
app.post("/send-message", async (req, res) => {
  // console.log(JSON.stringify(req.headers))
  // console.log(req)
  const message = req.body.message;
  const number = req.body.number;

  // console.log(await wa.onWhatsApp(number))
  if (isConnected) {
    const exists = await wa.onWhatsApp(number);
    if (exists?.jid || (exists && exists[0]?.jid)) {
      wa.sendMessage(exists.jid || exists[0].jid, { text: message })
        .then((result) => {
          res.status(200).json({
            status: true,
            response: result,
          });
        })
        .catch((err) => {
          res.status(500).json({
            status: false,
            response: err,
          });
        });
    } else {
      res.status(500).json({
        status: false,
        response: `Nomor ${number} tidak terdaftar.`,
      });
    }
  } else {
    res.status(500).json({
      status: false,
      response: `WhatsApp belum terhubung.`,
    });
  }
});

// functions
const updateQR = (data = "qr") => {
  switch (data) {
    case "qr":
      qrcode.toDataURL(qr, (err, url) => {
        sock?.emit("qr", url);
        sock?.emit("log", "QR Code received, please scan!");
      });
      break;
    case "connected":
      sock?.emit("qrstatus", "./assets/check.svg");
      sock?.emit("log", "WhatsApp terhubung!");
      break;
    case "loading":
      sock?.emit("qrstatus", "./assets/loader.gif");
      sock?.emit("log", "QR Code received, please scan!");
      break;
    default:
      break;
  }
};

const isConnected = () => {
  return (
    (wa.type === "md" && wa.user) ||
    (wa.type === "legacy" && wa.state?.legacy?.phoneConnected)
  );
};

server.listen(port, () => {
  console.log(`Aplikasi berjalan di http://localhost:${port}`);
  console.log(`Scan QR di http://localhost:${port}/scan`);
});
