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
  const player = state.players[socket.id];
  if (!player) return;

  let html = `
    <div class="panel">
      <b>🎯 Actions:</b> ${player.actionsLeft}
      <button class="btn" style="float:right;" onclick="endTurn()">End Turn</button>
    </div>

    <div class="panel">
      <b>🎯 Select Target</b><br>
  `;

  state.turnOrder.forEach(id => {
    if (id !== socket.id) {
      html += `<button class="btn" onclick="selectedTarget='${id}'">Player</button>`;
    }
  });

  html += `</div>`;

  document.getElementById("board").innerHTML = html;

  const hand = document.createElement("div");
  hand.className = "hand";

  player.hand.forEach((card, i) => {
    const el = document.createElement("div");
    el.className = "card";

    el.innerHTML = `
      <b>${card.type}</b><br>
      ${card.name || card.color || card.value}
    `;

    el.onclick = () => playCard(i);

    hand.appendChild(el);
  });

  document.getElementById("board").appendChild(hand);
});