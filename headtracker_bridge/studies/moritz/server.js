const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const PUBLIC = path.join(__dirname, "public");

const server = http.createServer((req, res) => {
  const file = path.join(PUBLIC, req.url === "/" ? "index.html" : req.url);
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200);
    res.end(data);
  });
});

server.listen(PORT, () => console.log(`http://localhost:${PORT}`));
