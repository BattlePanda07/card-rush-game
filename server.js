const express = require("express");
const app = express();
const http = require("http");
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(express.static("public"));

const rooms = {};

// ---------- GAME SETUP ----------

// // Kyen's Card Class attempt
// class Card {
// 	constructor(type, name, color=null, setAmount=null, value=null) {
// 		this.type = type;
// 		this.name = name;
// 		this.color = color;
// 		this.setAmount = setAmount;
// 		this.value = value;
// 	}
// }

function getPlayerState(room, viewerId) {
  return {
    turnIndex: room.turnIndex,
    turnOrder: room.turnOrder,
    deckCount: room.deck.length,

    players: Object.fromEntries(
      Object.entries(room.players).map(([id, p]) => [
        id,
        {
          hand: id === viewerId
            ? p.hand
            : p.hand.map(() => "hidden"),

          bank: p.bank,
          properties: p.properties,
          actionsLeft: p.actionsLeft
        }
      ])
    )
  };
}

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

function resetDeck(deck, discard) {
	deck = discard;
	discard.length = 0;
	return shuffleDeck(deck);
}

function shuffleDeck(deck) {	// Put all cards from discard into deck before calling 
	return deck.sort(() => Math.random() - 0.5);
}

function createDeck() {
  const deck = [];

  // MONEY
  [1,1,1,1,1,1,2,2,2,2,2,3,3,3,4,4,4,5,5,10].forEach(v =>
    deck.push({ type: "money", value: v })
  );

  // PROPERTIES (color sets)
  const cards = [	// All types of cards
	  {setAmount:2, color:"Brown", 		value:1},
	  {setAmount:3, color:"Light Blue", value:1}, 
	  {setAmount:3, color:"Pink", 		value:2}, 
	  {setAmount:3, color:"Orange", 	value:2}, 
	  {setAmount:3, color:"Red", 		value:3}, 
	  {setAmount:3, color:"Yellow", 	value:3}, 
	  {setAmount:3, color:"Green", 		value:4}, 
	  {setAmount:2, color:"Dark Blue", 	value:4}, 
	  {setAmount:4, color:"Black", 		value:2},	// Railroads
	  {setAmount:2, color:"White", 		value:2}	// Utilities
  ];
  
  cards.forEach(card => {	// Add cards to deck with type:"property"
    for (let i = 0; i < card.setAmount; i++) {
      deck.push(card);
	  deck[deck.length-1].type = "property";
    }
  });

  // ACTIONS (simplified Monopoly Deal feel)
  for (let i = 0; i < 13; i++) deck.push({ type: "action", name: "Rent" });
  for (let i = 0; i < 4; i++) deck.push({ type: "action", name: "Steal" });
  for (let i = 0; i < 2; i++) deck.push({ type: "action", name: "DealBreaker" });

  return shuffleDeck(deck);
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
  if (room.deck.length === 0) resetDeck(room.deck, room.discard);
  room.players[id].hand.push(room.deck.pop());
}

function nextTurn(room) {
  room.turnIndex = (room.turnIndex + 1) % room.turnOrder.length;	// Update Turn index (for next player's turn)

  const next = room.turnOrder[room.turnIndex];	// id of next player
  room.players[next].actionsLeft = 3;	// Reset action count of next player

  draw(room, next);	// next player draws 1st card
  draw(room, next);	// next player draws 2nd card
}

// ---------- SOCKET ----------
io.on("connection", (socket) => {

  socket.on("createRoom", (cb) => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();

    rooms[code] = {
      deck: createDeck(),
	  discard: [],
      players: {},
      turnOrder: [],
      turnIndex: 0
    };

    rooms[code].players[socket.id] = initPlayer();
    rooms[code].turnOrder.push(socket.id);

    for (let i = 0; i < 5; i++) draw(rooms[code], socket.id);	// Draw 5 at start of game

    socket.join(code);
    cb(code);

    io.to(code).emit("state", rooms[code]);
  });

  socket.on("joinRoom", (code, cb) => {	// When join someone joins a room
    const room = rooms[code];
    if (!room) return cb({ error: "Room not found" });

    room.players[socket.id] = initPlayer();
    room.turnOrder.push(socket.id);

    for (let i = 0; i < 5; i++) draw(room, socket.id);

    socket.join(code);
    cb({ ok: true });

    io.to(code).emit("state", getPublicState(room));
  });

  socket.on("playCard", ({ code, index, targetId }) => {	// When card "played" (clicked, whether or not it's your turn)
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
