const socket = io();

let room = "";
let selectedTarget = null;

function createRoom() {
  socket.emit("createRoom", (code) => {
    room = code;
    document.getElementById("room").innerText = "Room: " + code;
    document.getElementById("lobby").style.display = "none";
  });
}

function joinRoom() {
  const code = document.getElementById("code").value;

  socket.emit("joinRoom", code, (res) => {
    if (res.error) return alert(res.error);

    room = code;
    document.getElementById("room").innerText = "Room: " + code;
    document.getElementById("lobby").style.display = "none";
  });
}

function playCard(index) {
  socket.emit("playCard", {
    code: room,
    index,
    targetId: selectedTarget
  });
}

function endTurn() {
  socket.emit("endTurn", room);
}

socket.on("state", (state) => {
  const me = state.players[socket.id];
  if (!me) return;

  const myTurn = state.turnOrder[state.turnIndex] === socket.id;

  let html = `
    <div class="panel">
      <b>${myTurn ? "🔥 YOUR TURN" : "⏳ Waiting..."}</b><br>
      Actions: ${me.actionsLeft}
      <button onclick="endTurn()" style="float:right;">End Turn</button>
    </div>

    <div class="panel">
      <b>Players</b><br>
  `;

  state.turnOrder.forEach(id => {
    const p = state.players[id];
    html += `
      <div style="margin:6px 0;">
        👤 ${id === socket.id ? "YOU" : "OPPONENT"} <br>
        💰 Bank: $${p.bank.reduce((sum, c) => sum + (c.value || 0), 0)} cards <br>
        🏠 Properties: ${JSON.stringify(p.properties, null, " | ")}
      </div>
    `;
  });

  html += `</div>`;

  html += `
    <div class="panel">
      <b>Select Target:</b><br>
  `;

  state.turnOrder.forEach(id => {
    if (id !== socket.id) {
      html += `<button onclick="selectedTarget='${id}'">Target</button>`;
    }
  });

  html += `</div>`;

  const board = document.getElementById("board");
  board.innerHTML = html;

  // HAND RENDER (REAL CARDS)
  const hand = document.createElement("div");
  hand.className = "hand";

  me.hand.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "card";

    let label = "";

    if (card.type === "money") {
      label = `💰 $${card.value}`;
    }

    if (card.type === "property") {
      label = `🏠 ${card.color}`;
    }

    if (card.type === "action") {
      label = `⚡ ${card.name}`;
    }

    el.innerHTML = label;

    el.onclick = () => playCard(i);

    hand.appendChild(el);
  });

  board.appendChild(hand);
});
