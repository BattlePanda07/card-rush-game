const socket = io();

let room = "";
let selectedTarget = null;

function createRoom() {
  socket.emit("createRoom", (code) => {
    room = code;
    document.getElementById("room").innerText = code;
  });
}

function joinRoom() {
  const code = document.getElementById("code").value;

  socket.emit("joinRoom", code, (res) => {
    if (res.error) return alert(res.error);
    room = code;
    document.getElementById("room").innerText = code;
  });
}

function playCard(i, target) {
  socket.emit("playCard", {
    code: room,
    index: i,
    targetId: target
  });
}

function endTurn() {
  socket.emit("endTurn", room);
}

socket.on("state", (state) => {
  const player = state.players[socket.id];
  if (!player) return;

  let html = `<h3>Actions Left: ${player.actionsLeft}</h3>`;

  // TARGET SELECT
  html += `<p>Select target (optional):</p>`;
  html += state.turnOrder.map(id =>
    id !== socket.id
      ? `<button onclick="selectedTarget='${id}'">Target Player</button>`
      : ""
  ).join("");

  // HAND
  html += `<div class="hand">`;

  player.hand.forEach((card, i) => {
    html += `
      <div class="card" onclick="playCard(${i}, selectedTarget)">
        ${card.type}<br>${card.name || card.color || card.value}
      </div>
    `;
  });

  html += `</div>`;

  html += `<br><button onclick="endTurn()">End Turn</button>`;

  document.getElementById("game").innerHTML = html;
});