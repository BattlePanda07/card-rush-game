const socket = io();

let room = "";
let selectedTarget = null;

function createRoom() {
  socket.emit("createRoom", (code) => {
    room = code;
    document.getElementById("room").innerText = code;
    document.getElementById("lobby").style.display = "none";
  });
}

function joinRoom() {
  const code = document.getElementById("code").value;

  socket.emit("joinRoom", code, (res) => {
    if (res.error) return alert(res.error);

    room = code;
    document.getElementById("room").innerText = code;
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

  let html = "";

  // TURN INFO
  const myTurn = state.turnOrder[state.turnIndex] === socket.id;

  html += `
    <div class="panel">
      <b>${myTurn ? "🔥 YOUR TURN" : "⏳ Waiting..."}</b><br>
      Actions Left: ${me.actionsLeft}
    </div>
  `;

  // PLAYERS LIST
  html += `<div class="panel"><b>Players</b><br>`;

  state.turnOrder.forEach(id => {
    const p = state.players[id];
    html += `
      <div style="margin:6px 0;">
        👤 ${id === socket.id ? "YOU" : "OPPONENT"} <br>
        💰 Bank: ${p.bank.length} cards <br>
        🏠 Properties: ${JSON.stringify(p.properties)}
      </div>
    `;
  });

  html += `</div>`;

  // HAND
  const hand = document.createElement("div");
  hand.className = "hand";

  me.handCount = me.handCount || 0;

  for (let i = 0; i < me.handCount; i++) {
    const card = document.createElement("div");
    card.className = "card";
    card.innerText = "Card";
    card.onclick = () => playCard(i);

    hand.appendChild(card);
  }

  const board = document.getElementById("board");
  board.innerHTML = html;
  board.appendChild(hand);
});