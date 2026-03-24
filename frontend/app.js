const CONFIG = {
  network:           "TESTNET",
  networkPassphrase: StellarSdk.Networks.TESTNET,
  rpcUrl:            "https://soroban-testnet.stellar.org",
  horizonUrl:        "https://horizon-testnet.stellar.org",
  // ▼ Replace with your deployed contract ID after running scripts/deploy.sh
  contractId:        "YOUR_CONTRACT_ID_HERE",
  // Native XLM token on testnet
  xlmToken:          "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
};

let walletAddress = null;
let campaigns     = [];
let currentCampaignId = null;
let server        = null;
let rpc           = null;

document.addEventListener("DOMContentLoaded", () => {
  initStarfield();
  initClients();
  loadCampaigns();
  initFilterButtons();
});

function initClients() {
  server = new StellarSdk.Horizon.Server(CONFIG.horizonUrl);
  rpc    = new StellarSdk.SorobanRpc.Server(CONFIG.rpcUrl);
}

function initStarfield() {
  const canvas = document.getElementById("starfield");
  const ctx    = canvas.getContext("2d");
  let stars    = [];

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 200; i++) {
      stars.push({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height,
        r:     Math.random() * 1.5,
        alpha: Math.random(),
        speed: Math.random() * 0.003 + 0.001,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now() / 1000;
    stars.forEach(s => {
      const a = (Math.sin(now * s.speed * 10 + s.phase) + 1) / 2 * 0.7 + 0.1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(163,186,255,${a * s.alpha})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }

  resize();
  createStars();
  draw();
  window.addEventListener("resize", () => { resize(); createStars(); });
}

async function connectWallet() {
  if (typeof window.freighterApi === "undefined") {
    showToast("Freighter wallet not found. Install it from freighter.app", "error");
    return;
  }
  try {
    const { address } = await window.freighterApi.requestAccess();
    walletAddress = address;
    updateWalletUI(true);
    showToast(`Connected: ${shortAddr(address)}`, "success");
    loadCampaigns();
  } catch (e) {
    showToast("Connection rejected", "error");
  }
}

function disconnectWallet() {
  walletAddress = null;
  updateWalletUI(false);
  showToast("Wallet disconnected");
}

function updateWalletUI(connected) {
  const pill = document.getElementById("wallet-address");
  const conn = document.getElementById("connect-btn");
  const disc = document.getElementById("disconnect-btn");
  if (connected) {
    pill.textContent = shortAddr(walletAddress);
    pill.classList.remove("hidden");
    conn.classList.add("hidden");
    disc.classList.remove("hidden");
  } else {
    pill.classList.add("hidden");
    conn.classList.remove("hidden");
    disc.classList.add("hidden");
  }
}

async function invokeContract(method, args = [], simulate = false) {
  if (!walletAddress) throw new Error("Wallet not connected");
  if (CONFIG.contractId === "YOUR_CONTRACT_ID_HERE")
    throw new Error("Contract not deployed yet. Run scripts/deploy.sh first.");

  const contract = new StellarSdk.Contract(CONFIG.contractId);
  const account  = await rpc.getAccount(walletAddress);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee:              StellarSdk.BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simResult = await rpc.simulateTransaction(tx);
  if (StellarSdk.SorobanRpc.Api.isSimulationError(simResult))
    throw new Error(simResult.error);

  if (simulate) return simResult;

  const prepared = StellarSdk.SorobanRpc.assembleTransaction(tx, simResult).build();
  const { signedTxXdr } = await window.freighterApi.signTransaction(
    prepared.toXDR(),
    { network: CONFIG.network, networkPassphrase: CONFIG.networkPassphrase }
  );

  const signed  = StellarSdk.TransactionBuilder.fromXDR(signedTxXdr, CONFIG.networkPassphrase);
  const sendRes = await rpc.sendTransaction(signed);

  let status = sendRes;
  for (let i = 0; i < 20; i++) {
    await sleep(1500);
    status = await rpc.getTransaction(sendRes.hash);
    if (status.status === "SUCCESS") return status;
    if (status.status === "FAILED")
      throw new Error("Transaction failed: " + JSON.stringify(status));
  }
  throw new Error("Transaction timeout");
}

async function loadCampaigns() {
  const grid = document.getElementById("campaigns-grid");

  if (CONFIG.contractId === "YOUR_CONTRACT_ID_HERE") {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Deploy the contract first</h3>
        <p style="margin-top:8px;font-family:var(--mono);font-size:0.8rem;">
          Run <code>bash scripts/deploy.sh</code> then update<br/>
          <code>CONFIG.contractId</code> in <code>frontend/app.js</code>
        </p>
      </div>`;
    return;
  }

  grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><p>Fetching campaigns from Stellar Testnet…</p></div>`;

  try {
    const countResult = await invokeReadOnly("get_campaign_count", []);
    const count = StellarSdk.scValToNative(countResult.result.retval);

    campaigns = [];
    for (let i = 1; i <= count; i++) {
      const res = await invokeReadOnly("get_campaign", [
        StellarSdk.xdr.ScVal.scvU32(i),
      ]);
      const raw = StellarSdk.scValToNative(res.result.retval);
      campaigns.push(normalizeCampaign(raw, i));
    }

    renderCampaigns(campaigns);
    updateStats();
  } catch (e) {
    console.error(e);
    grid.innerHTML = `<div class="empty-state"><p>Could not load campaigns: ${e.message}</p></div>`;
  }
}

async function invokeReadOnly(method, args = []) {
  if (!CONFIG.contractId || CONFIG.contractId === "YOUR_CONTRACT_ID_HERE")
    throw new Error("Contract ID not set");

  const contract = new StellarSdk.Contract(CONFIG.contractId);
  const keypair  = StellarSdk.Keypair.random();
  const account  = new StellarSdk.Account(keypair.publicKey(), "0");

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee:               StellarSdk.BASE_FEE,
    networkPassphrase: CONFIG.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  return await rpc.simulateTransaction(tx);
}

function normalizeCampaign(raw, id) {
  const now     = Math.floor(Date.now() / 1000);
  const goal    = Number(raw.goal)   / 1e7;
  const raised  = Number(raw.raised) / 1e7;
  const pct     = Math.min(100, goal > 0 ? (raised / goal) * 100 : 0);
  const expired = now > Number(raw.deadline);
  const funded  = raised >= goal;
  let status    = "active";
  if (funded)        status = "funded";
  else if (expired)  status = "expired";

  return {
    id,
    creator:    raw.creator?.toString() ?? raw.creator,
    title:      raw.title,
    description: raw.description,
    goal,
    raised,
    pct,
    deadline:   Number(raw.deadline),
    is_active:  raw.is_active,
    withdrawn:  raw.withdrawn,
    status,
  };
}

function renderCampaigns(list) {
  const grid = document.getElementById("campaigns-grid");
  if (!list.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No campaigns yet</h3>
        <p style="margin-top:8px;color:var(--text-muted);">Be the first to launch a campaign on StarFund!</p>
      </div>`;
    return;
  }

  grid.innerHTML = list.map(c => {
    const badgeClass = c.status === "active"  ? "badge-active"
                     : c.status === "funded"  ? "badge-funded"
                     :                          "badge-expired";
    const badgeText  = c.status.charAt(0).toUpperCase() + c.status.slice(1);
    const daysLeft   = Math.max(0, Math.ceil((c.deadline - Date.now() / 1000) / 86400));
    const isCreator  = walletAddress && walletAddress === c.creator;

    return `
      <div class="campaign-card" data-status="${c.status}">
        <div class="card-header">
          <span class="card-id">#${c.id}</span>
          <span class="card-badge ${badgeClass}">${badgeText}</span>
        </div>
        <h3 class="card-title">${escHtml(c.title)}</h3>
        <p class="card-desc">${escHtml(c.description)}</p>
        <div class="progress-wrap">
          <div class="progress-info">
            <span class="raised">${c.raised.toFixed(2)} XLM raised</span>
            <span>${c.pct.toFixed(0)}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:${c.pct}%"></div>
          </div>
        </div>
        <div class="card-meta">
          <span>${c.status === "active" ? `${daysLeft}d left` : (c.status === "funded" ? "Goal reached!" : "⌛ Ended")}</span>
          <span>Goal: ${c.goal} XLM</span>
        </div>
        <div class="card-creator">${shortAddr(c.creator)}</div>
        <div class="card-actions" style="margin-top:16px;">
          ${c.status === "active" ? `<button class="btn btn-primary btn-sm" onclick="openContribute(${c.id})">✦ Fund</button>` : ""}
          ${isCreator && c.raised > 0 && !c.withdrawn && (c.status === "funded" || c.status === "expired")
            ? `<button class="btn btn-ghost btn-sm" onclick="withdrawFunds(${c.id})">Withdraw</button>` : ""}
          ${c.status === "expired" && c.raised < c.goal
            ? `<button class="btn btn-ghost btn-sm" onclick="requestRefund(${c.id})">Refund</button>` : ""}
        </div>
      </div>`;
  }).join("");
}

function initFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const f = btn.dataset.filter;
      renderCampaigns(f === "all" ? campaigns : campaigns.filter(c => c.status === f));
    });
  });
}

function updateStats() {
  document.getElementById("stat-campaigns").textContent = campaigns.length;
  const total = campaigns.reduce((s, c) => s + c.raised, 0);
  document.getElementById("stat-raised").textContent    = total.toFixed(2) + " XLM";
}

async function createCampaign() {
  if (!walletAddress) { showToast("Connect your wallet first!", "error"); return; }

  const title    = document.getElementById("camp-title").value.trim();
  const desc     = document.getElementById("camp-desc").value.trim();
  const goal     = parseFloat(document.getElementById("camp-goal").value);
  const duration = parseInt(document.getElementById("camp-duration").value);

  if (!title || !desc || isNaN(goal) || isNaN(duration)) {
    showToast("Please fill in all fields", "error");
    return;
  }
  if (goal < 1)          { showToast("Goal must be at least 1 XLM", "error"); return; }
  if (duration < 1 || duration > 90) { showToast("Duration must be 1-90 days", "error"); return; }

  try {
    showToast("Launching campaign…");
    const goalStroops = BigInt(Math.round(goal * 1e7));

    await invokeContract("create_campaign", [
      StellarSdk.nativeToScVal(walletAddress, { type: "address" }),
      StellarSdk.nativeToScVal(title,    { type: "string" }),
      StellarSdk.nativeToScVal(desc,     { type: "string" }),
      StellarSdk.nativeToScVal(goalStroops, { type: "i128" }),
      StellarSdk.nativeToScVal(BigInt(duration), { type: "u64" }),
    ]);

    showToast("Campaign launched on Stellar Testnet!", "success");
    closeModal("create-modal");
    clearForm("create-modal");
    await loadCampaigns();
  } catch (e) {
    showToast("Error: " + e.message, "error");
    console.error(e);
  }
}

function openContribute(campaignId) {
  if (!walletAddress) { showToast("Connect your wallet first!", "error"); return; }
  const c = campaigns.find(x => x.id === campaignId);
  if (!c) return;
  currentCampaignId = campaignId;
  document.getElementById("contrib-campaign-title").textContent = `Fund: ${c.title}`;
  document.getElementById("contrib-preview").innerHTML = `
    <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
      <span style="color:var(--text-muted);font-size:0.8rem;">Goal</span>
      <span style="font-family:var(--mono);font-size:0.8rem;">${c.goal} XLM</span>
    </div>
    <div style="display:flex;justify-content:space-between;">
      <span style="color:var(--text-muted);font-size:0.8rem;">Raised</span>
      <span style="font-family:var(--mono);font-size:0.8rem;color:var(--accent);">${c.raised.toFixed(2)} XLM (${c.pct.toFixed(0)}%)</span>
    </div>`;
  openModal("contribute-modal");
}

async function contribute() {
  if (!walletAddress || !currentCampaignId) return;
  const amount = parseFloat(document.getElementById("contrib-amount").value);
  if (isNaN(amount) || amount < 1) { showToast("Minimum contribution is 1 XLM", "error"); return; }

  try {
    showToast("Processing contribution…");
    const stroops = BigInt(Math.round(amount * 1e7));

    await invokeContract("contribute", [
      StellarSdk.nativeToScVal(walletAddress,        { type: "address" }),
      StellarSdk.xdr.ScVal.scvU32(currentCampaignId),
      StellarSdk.nativeToScVal(CONFIG.xlmToken,      { type: "address" }),
      StellarSdk.nativeToScVal(stroops,              { type: "i128" }),
    ]);

    showToast(`Contributed ${amount} XLM!`, "success");
    closeModal("contribute-modal");
    await loadCampaigns();
  } catch (e) {
    showToast("Error: " + e.message, "error");
    console.error(e);
  }
}

async function withdrawFunds(campaignId) {
  if (!walletAddress) return;
  try {
    showToast("Processing withdrawal…");
    await invokeContract("withdraw", [
      StellarSdk.xdr.ScVal.scvU32(campaignId),
      StellarSdk.nativeToScVal(CONFIG.xlmToken, { type: "address" }),
    ]);
    showToast("Funds withdrawn!", "success");
    await loadCampaigns();
  } catch (e) {
    showToast("Error: " + e.message, "error");
  }
}

async function requestRefund(campaignId) {
  if (!walletAddress) return;
  try {
    showToast("Processing refund…");
    await invokeContract("refund", [
      StellarSdk.nativeToScVal(walletAddress, { type: "address" }),
      StellarSdk.xdr.ScVal.scvU32(campaignId),
      StellarSdk.nativeToScVal(CONFIG.xlmToken, { type: "address" }),
    ]);
    showToast("Refund processed!", "success");
    await loadCampaigns();
  } catch (e) {
    showToast("Error: " + e.message, "error");
  }
}

function openModal(id)  { document.getElementById(id).classList.remove("hidden"); }
function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

function closeModalOutside(event, id) {
  if (event.target.id === id) closeModal(id);
}

function scrollToCampaigns() {
  document.getElementById("campaigns-section").scrollIntoView({ behavior: "smooth" });
}

let toastTimer = null;
function showToast(msg, type = "info") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className   = `toast ${type}`;
  t.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.add("hidden"), 4000);
}

function shortAddr(addr) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function clearForm(modalId) {
  document.querySelectorAll(`#${modalId} .form-input`).forEach(i => i.value = "");
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }