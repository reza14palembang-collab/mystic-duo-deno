import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { acceptWebSocket, acceptable } from "https://deno.land/std@0.177.0/ws/mod.ts";

const rooms = new Map<string, WebSocket[]>();

async function reqHandler(req: Request) {
  // serve static file
  const url = new URL(req.url);
  if (url.pathname === "/" || url.pathname === "/index.html") {
    const html = await Deno.readTextFile("./public/index.html");
    return new Response(html, { headers: { "content-type": "text/html" } });
  }
  // WebSocket upgrade
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = await acceptWebSocket(req);
    const room = url.searchParams.get("room") || "default";
    if (!rooms.has(room)) rooms.set(room, []);
    const socks = rooms.get(room)!;
    if (socks.length >= 2) {
      socket.close(1000, "full");
      return response;
    }
    socks.push(socket);
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "joined", player: socks.length }));
      socks.forEach((s) => s !== socket && s.send(JSON.stringify({ type: "ready" })));
    };
    socket.onmessage = (m) => {
      const data = JSON.parse(m.data);
      socks.forEach((s) => s !== socket && s.send(JSON.stringify(data)));
    };
    socket.onclose = () => {
      const idx = socks.indexOf(socket);
      if (idx > -1) socks.splice(idx, 1);
      if (socks.length === 0) rooms.delete(room);
    };
    return response;
  }
  return new Response("Not Found", { status: 404 });
}

serve(reqHandler, { port: 8000 });