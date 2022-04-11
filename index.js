
const http = require("http")
const qrcode = require("qrcode")
const express = require("express")
const socketIO = require("socket.io")

const port = 8000 || process.env.PORT
const app = express()
const server = http.createServer(app)
const io = socketIO(server)

const fabuya = require('fabuya');

let config = {};
fabuya.create('FabuyaWho', config).then((client) => {
	// When QR changed or created
	// display them on console
	client.onQRUpdated((qr) => {
		console.log(qr);
	});
	
	// This is when the QR has been scanned
	client.onQRScanned(() => {
		console.log("[*] QR Code scanned, logging in...");
	});

	// This is fired when new incoming/outgoing
	// messages sent. Currently, the library also
	// includes system messages
	client.onMessage((msg) => {
		console.log("[i] New message: ", msg.content);
		msg.reply("Hello!");
	});
});

// Keep the program going
// omit this if you have other implementation
fabuya.forever();

server.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`)
    console.log(`Aplikasi Client di http://localhost:${port}/client`)
})