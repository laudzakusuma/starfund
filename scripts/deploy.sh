set -e

echo "StarFund — Deploying to Stellar Testnet"

NETWORK="testnet"
NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
RPC_URL="https://soroban-testnet.stellar.org"
ACCOUNT="starfund-deployer"  # stellar-cli identity name

echo ""
echo "Step 1: Setting up deployer account..."

# Check if identity exists
if ! stellar keys address "$ACCOUNT" 2>/dev/null; then
    echo "  Creating new identity: $ACCOUNT"
    stellar keys generate "$ACCOUNT" --network "$NETWORK"
else
    echo "  Using existing identity: $ACCOUNT"
fi

DEPLOYER_ADDRESS=$(stellar keys address "$ACCOUNT")
echo "  Address: $DEPLOYER_ADDRESS"

echo "  Funding from friendbot..."
curl -s "https://friendbot.stellar.org?addr=$DEPLOYER_ADDRESS" > /dev/null && echo "Funded!" || echo "Already funded or failed"

echo ""
echo "Step 2: Building Soroban contract..."
cd "$(dirname "$0")/.."
stellar contract build
echo "Contract built!"

WASM_FILE="target/wasm32-unknown-unknown/release/starfund.wasm"

if [ ! -f "$WASM_FILE" ]; then
    echo "WASM file not found: $WASM_FILE"
    exit 1
fi

echo "  WASM size: $(du -sh $WASM_FILE | cut -f1)"

echo ""
echo "Step 3: Uploading contract to testnet..."

WASM_HASH=$(stellar contract upload \
    --network "$NETWORK" \
    --source "$ACCOUNT" \
    --wasm "$WASM_FILE" 2>&1 | tail -1)

echo "WASM Hash: $WASM_HASH"

echo ""
echo "Step 4: Deploying contract instance..."

CONTRACT_ID=$(stellar contract deploy \
    --network "$NETWORK" \
    --source "$ACCOUNT" \
    --wasm-hash "$WASM_HASH" 2>&1 | tail -1)

echo "Contract ID: $CONTRACT_ID"

echo ""
echo "Step 5: Saving deployment info..."

cat > "$(dirname "$0")/../frontend/deployment.json" <<EOF
{
  "network": "$NETWORK",
  "rpcUrl": "$RPC_URL",
  "networkPassphrase": "$NETWORK_PASSPHRASE",
  "contractId": "$CONTRACT_ID",
  "wasmHash": "$WASM_HASH",
  "deployedBy": "$DEPLOYER_ADDRESS",
  "deployedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

echo "Saved to frontend/deployment.json"

echo ""
echo "Deployment Complete!"
echo "  Contract ID : $CONTRACT_ID"
echo "  Network     : Stellar Testnet"
echo "  Explorer    : https://stellar.expert/explorer/testnet/contract/$CONTRACT_ID"
echo ""
echo "Next steps:"
echo "  1. Copy CONTRACT_ID to frontend/app.js"
echo "  2. Open frontend/index.html in a browser"
echo "  3. Connect Freighter wallet and start using StarFund!"