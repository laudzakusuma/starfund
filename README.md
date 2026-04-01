# ✦ StarFund — Decentralized Micro-Crowdfunding on Stellar

> **Build On Stellar Workshop · Jakarta 2025**  
> A unique dApp for funding ideas on-chain — no middlemen, no borders, just Stellar.

![StarFund Banner](https://img.shields.io/badge/Stellar-Testnet-6382ff?style=for-the-badge&logo=stellar)
![Soroban](https://img.shields.io/badge/Soroban-Smart_Contracts-a78bfa?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-34d399?style=for-the-badge)

---

## 📖 Overview

**StarFund** is a decentralized crowdfunding platform built on the Stellar blockchain using [Soroban](https://soroban.stellar.org/) smart contracts. Anyone can launch a campaign to raise XLM for their project, and the community can contribute directly from their Stellar wallet — all governed by transparent, immutable smart contract logic.

### Why StarFund?

| Traditional Crowdfunding | StarFund |
|--------------------------|----------|
| High platform fees (5–12%) | Zero platform fees |
| Centralized fund custody | Funds held by smart contract |
| Geographic restrictions | Global, permissionless |
| Opaque fund usage | Fully on-chain & transparent |
| Slow bank transfers | Instant Stellar settlement |

---

## 🌟 Features

- **Create Campaigns** — Set a title, description, XLM goal, and duration (1–90 days)
- **Contribute XLM** — Fund any campaign directly from Freighter wallet
- **Auto Goal Detection** — Campaign closes automatically when goal is reached
- **Creator Withdrawal** — Campaign creator can withdraw once goal is met or deadline passes
- **Contributor Refund** — Get your XLM back if the campaign expires without reaching its goal
- **Real-time Stats** — Live campaign progress bars and contribution tracking
- **Testnet Ready** — Fully deployed and testable on Stellar Testnet

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|------------|
| Smart Contract | Rust + Soroban SDK v21 |
| Frontend | HTML5, CSS3, Vanilla JS |
| Stellar SDK | stellar-sdk v12 (browser) |
| Wallet | Freighter Browser Extension |
| Network | Stellar Testnet (Soroban RPC) |
| Deployment | stellar-cli |

---

## 📁 Project Structure

```
starfund/
├── contracts/
│   └── starfund/
│       ├── Cargo.toml          # Contract dependencies
│       └── src/
│           └── lib.rs          # Soroban smart contract
├── frontend/
│   ├── index.html              # Main dApp UI
│   ├── styles.css              # Cosmic dark theme
│   ├── app.js                  # Stellar SDK + contract interaction
│   └── deployment.json         # Generated after deploy (contract ID, etc.)
├── scripts/
│   └── deploy.sh               # One-click testnet deployment
├── Cargo.toml                  # Workspace manifest
└── README.md
```

---

## 🚀 Setup & Installation

### Prerequisites

Make sure you have the following installed:

```bash
# 1. Rust with WASM targets
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# stellar-cli v21+ uses wasm32v1-none; older versions use wasm32-unknown-unknown
# Install BOTH to avoid target errors:
rustup target add wasm32-unknown-unknown
rustup target add wasm32v1-none

# 2. Stellar CLI
cargo install --locked stellar-cli --features opt

# 3. Freighter Wallet (browser extension)
# → https://freighter.app
```

---

## 🔨 Build the Smart Contract

```bash
# Clone the repository
git clone https://github.com/your-username/starfund.git
cd starfund

# Build the Soroban contract
stellar contract build

# The compiled WASM will be at:
# target/wasm32-unknown-unknown/release/starfund.wasm
```

---

## 🌐 Deploy to Stellar Testnet

```bash
# Make the deploy script executable
chmod +x scripts/deploy.sh

# Run the deploy script (creates account, funds it, uploads & deploys)
bash scripts/deploy.sh
```

The script will:
1. Generate a Stellar keypair for the deployer
2. Fund it via Friendbot (testnet faucet)
3. Build and upload the contract WASM
4. Deploy a contract instance
5. Save the **Contract ID** to `frontend/deployment.json`

After deployment, update `CONFIG.contractId` in `frontend/app.js`:

```javascript
const CONFIG = {
  contractId: "CDT46NXHKKAURLBC4VUNRYT4EFFHZBDQN6YR6H2MRZ6P5KIFJ3IE6KZM",
  // ...
};
```

---

## 💻 Run the Frontend

Since this is a static frontend (HTML + CSS + JS), just open it in your browser:

```bash
# Option 1: Open directly
open frontend/index.html

# Option 2: Serve with Python (recommended for local development)
cd frontend
python3 -m http.server 3000
# Visit: http://localhost:3000
```

> **Note:** The Freighter wallet extension works best when the page is served over HTTP/HTTPS. Use Option 2 for full functionality.

---

## 🎮 Usage Guide

### 1. Connect Wallet
- Install [Freighter](https://freighter.app) and set network to **Testnet**
- Get free testnet XLM from [Stellar Friendbot](https://friendbot.stellar.org)
- Click **"Connect Freighter"** in the top-right corner

### 2. Create a Campaign
- Click **"✦ Start a Campaign"**
- Fill in the title, description, goal (XLM), and duration
- Sign the transaction in Freighter
- Your campaign appears live on the grid!

### 3. Fund a Campaign
- Browse active campaigns
- Click **"✦ Fund"** on any campaign you'd like to support
- Enter the amount (minimum 1 XLM) and sign

### 4. Withdraw Funds (Campaign Creator)
- When your campaign reaches its goal (or deadline passes), a **"Withdraw"** button appears
- Click it to transfer raised funds to your wallet

### 5. Request Refund (Contributor)
- If a campaign expires without reaching its goal, a **"Refund"** button appears
- Click it to get your contribution back

---

## 📜 Smart Contract API

| Function | Description | Auth Required |
|----------|-------------|---------------|
| `create_campaign(creator, title, desc, goal, duration_days)` | Launch a new campaign | Creator |
| `contribute(contributor, campaign_id, token, amount)` | Fund a campaign with XLM | Contributor |
| `withdraw(campaign_id, token)` | Withdraw raised funds | Campaign Creator |
| `refund(contributor, campaign_id, token)` | Refund expired contribution | Contributor |
| `get_campaign(id)` | Read campaign data | None |
| `get_campaign_count()` | Total campaigns created | None |
| `get_contribution(campaign_id, contributor)` | Check contribution amount | None |
| `get_contributors(campaign_id)` | List all contributors | None |

---

## 🧪 Testing on Testnet

1. Get testnet XLM:  
   `https://friendbot.stellar.org?addr=YOUR_STELLAR_ADDRESS`

2. Check your contract on the explorer:  
   `https://stellar.expert/explorer/testnet/contract/CDT46NXHKKAURLBC4VUNRYT4EFFHZBDQN6YR6H2MRZ6P5KIFJ3IE6KZM`

3. Inspect transactions:  
   `https://horizon-testnet.stellar.org/transactions`

---

## 🔒 Security Considerations

- All fund transfers go through the Soroban smart contract — no admin keys
- Contributions are refundable if campaign fails to meet its goal
- Campaign creator must authenticate with their Stellar keypair to withdraw
- Contract uses Stellar's native token (XLM) via the SAC (Stellar Asset Contract)

---

## 🗺 Roadmap

- [ ] Campaign categories & tags
- [ ] NFT reward tiers for contributors  
- [ ] Multi-token support (USDC, BTC via Stellar anchors)
- [ ] DAO governance for featured campaigns
- [ ] Mainnet deployment

---

## 👥 Contributing

Pull requests are welcome! For major changes, please open an issue first.

```bash
git checkout -b feature/your-feature
git commit -m "feat: add your feature"
git push origin feature/your-feature
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🙏 Acknowledgments

- [Stellar Development Foundation](https://stellar.org) for Soroban
- [Freighter](https://freighter.app) for the wallet SDK
- Build On Stellar Workshop Jakarta 2025

---

> *Built with ♥ on Stellar · Jakarta, Indonesia 🇮🇩*
