const https = require("https");
const fs = require("fs");
const express = require("express");

// прочитайте ключи
const key = fs.readFileSync("localhost.key");
const cert = fs.readFileSync("localhost.crt");

// создайте экспресс-приложение
const app = express();

// создайте HTTPS-сервер
const server = https.createServer({ key, cert }, app);

app.use(express.static(__dirname));

// добавьте тестовый роут
app.get('/', (req, res) => {
    res.sendFile(`${__dirname}/index.html`);
});

// запустите сервер на порту 8000
server.listen(8000, () => {
    console.log("listening on 8000");
});