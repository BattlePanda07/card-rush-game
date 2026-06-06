const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

// ---------- GAME SETUP ----------

function currentPlayer(room) {
  return room.turnOrder[room.turnIndex];
}
function getPublicState(room) {
  return {
    turnIndex: room.turnIndex,
    turnOrder: room.turnOrder,
    deckCount: room.deck.length,

    players: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [
        id,
        {
          hand: id === currentPlayer(room) ? p.hand : p.hand.map(() => "hidden"),
          bank: p.bank,
          properties: p.properties,
          actionsLeft: p.actionsLeft
        }
      ])
    )
  };
}
function createDeck() {
  const deck = [];

  // MONEY
  [1,1,1,1,2,2,2,3,3,4,5].forEach(v =>
    deck.push({ type: "money", value: v })
  );

  // PROPERTIES (color sets)
  const colors = ["Red", "Blue", "Green", "Yellow", "Orange"];
  colors.forEach(color => {
    for (let i = 0; i < 6; i++) {
      deck.push({ type: "property", color });
    }
  });

  // ACTIONS (simplified Monopoly Deal feel)
  for (let i = 0; i < 6; i++) deck.push({ type: "action", name: "Rent" });
  for (let i = 0; i < 4; i++) deck.push({ type: "action", name: "Steal" });
  for (let i = 0; i < 4; i++) deck.push({ type: "action", name: "DealBreaker" });

  return deck.sort(() => Math.random() - 0.5);
}

function initPlayer() {
  return {
    hand: [],
    bank: [],
    properties: {}, // { Red: 2 }
    actionsLeft: 3
  };
}

function draw(room, id) {
  if (room.deck.length === 0) return;
  room.players[id].hand.push(room.deck.pop());
}

function nextTurn(room) {
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;

  const next = room.turnOrder[room.turnIndex];
  room.players[next].actionsLeft = 3;

  draw(room, next);
}

// ---------- SOCKET ----------
io.on("connection", (socket) => {

  socket.on("createRoom", (cb) => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[code] = {
      deck: createDeck(),
      players: {},
      turnOrder: [],
      turnIndex: 0
    };

    rooms[code].players[socket.id] = initPlayer();
    rooms[code].turnOrder.push(socket.id);

    for (let i = 0; i < 5; i++) draw(rooms[code], socket.id);

    socket.join(code);
    cb(code);

    io.to(code).emit("state", rooms[code]);
  });

  socket.on("joinRoom", (code, cb) => {
    const room = rooms[code];
    if (!room) return cb({ error: "Room not found" });

    room.players[socket.id] = initPlayer();
    room.turnOrder.push(socket.id);

    for (let i = 0; i < 5; i++) draw(room, socket.id);

    socket.join(code);
    cb({ ok: true });

    io.to(code).emit("state", getPublicState(room));
  });

  socket.on("playCard", ({ code, index, targetId }) => {
    const room = rooms[code];
    const player = room.players[socket.id];

    if (!room || !player) return;

    if (player.actionsLeft <= 0) return;
	
    if (socket.id !== currentPlayer(room)) return;
    const card = player.hand.splice(index, 1)[0];
    player.actionsLeft--;

    // -------- MONEY --------
    if (card.type === "money") {
      player.bank.push(card);
    }

    // -------- PROPERTY --------
    if (card.type === "property") {
      player.properties[card.color] =
        (player.properties[card.color] || 0) + 1;
    }

    // -------- ACTIONS --------
    if (card.type === "action") {

      // RENT (simple version)
      if (card.name === "Rent") {
        const colors = Object.keys(player.properties);
        const color = colors[0];

        if (color) {
          const amount = player.properties[color] * 2;

          const target = room.players[targetId];
          if (target) {
            let paid = 0;

            while (target.bank.length && paid < amount) {
              player.bank.push(target.bank.pop());
              paid++;
            }
          }
        }
      }

      // STEAL (take random property)
      if (card.name === "Steal" && targetId) {
        const target = room.players[targetId];
        const colors = Object.keys(target.properties);

        if (colors.length) {
          const color = colors[0];
          target.properties[color]--;

          player.properties[color] =
            (player.properties[color] || 0) + 1;
        }
      }

      // DEALBREAKER (steal full set)
      if (card.name === "DealBreaker" && targetId) {
        const target = room.players[targetId];
        const colors = Object.keys(target.properties);

        if (colors.length) {
          const color = colors[0];
          player.properties[color] =
            (player.properties[color] || 0) +
            target.properties[color];

          target.properties[color] = 0;
        }
      }
    }

    io.to(code).emit("state", getPublicState(room));
  });

  socket.on("endTurn", (code) => {
    const room = rooms[code];
    if (!room) return;

    room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;

    const next = currentPlayer(room);
    room.players[next].actionsLeft = 3;

    draw(room, next);

    io.to(code).emit("state", getPublicState(room));
  });
});

server.listen(3000, () => console.log("Running on 3000"));
