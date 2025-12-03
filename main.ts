// main.ts - WebSocket server native Deno
const rooms = new Map<string, WebSocket[]>();

function handleWebSocket(ws: WebSocket, room: string) {
  if (!rooms.has(room)) rooms.set(room, []);
  const socks = rooms.get(room)!;
  if (socks.length >= 2) return ws.close(1000, "full");
  socks.push(ws);
  ws.onopen = () => {
    ws.send(JSON.stringify({ type: "joined", player: socks.length }));
    socks.forEach(s => s !== ws && s.send(JSON.stringify({ type: "ready" })));
  };
  ws.onmessage = (m) => {
    const data = JSON.parse(m.data);
    socks.forEach(s => s !== ws && s.send(JSON.stringify(data)));
  };
  ws.onclose = () => {
    const idx = socks.indexOf(ws);
    if (idx > -1) socks.splice(idx, 1);
    if (socks.length === 0) rooms.delete(room);
  };
}

// serve HTTP + upgrade WebSocket
serve((req) => {
  const url = new URL(req.url);
  // static file
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return new Response(Deno.readTextFileSync("./public/index.html"), {
      headers: { "content-type": "text/html" }
    });
  }
  // WebSocket upgrade
  if (url.pathname === "/ws") {
    const room = url.searchParams.get("room") || "default";
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleWebSocket(socket, room);
    return response;
  }
  return new Response("Not Found", { status: 404 });
}, { port: 8000 });
