# Cross-Chain Bridge Project

[🇬🇧 English](#english) | [🇫🇷 Français](#français)

---

<a name="english"></a>
## 🇬🇧 English

### What is this project?

This is a cross-chain bridge that allows tokens to be transferred between Ethereum Holesky and Sepolia test networks.

### How it works

1. User deposits tokens on one chain
2. Bridge detects the deposit
3. Bridge sends tokens on the other chain

### Contract Addresses

* **Bridge (Holesky)**: `0x95A4d51e1a79b21F25dF862240f0786bCf051DA8`
* **Bridge (Sepolia)**: `0x84A6ada6B3d7a4D5850F08361Ce6ecbCbD199e3B`
* **Token (Both)**: `0x74175129C0f2c42F2d5D0BE94DAE1c0a881018De`

### Setup

1. Clone the repository:
```bash
git clone https://github.com/linadevinci/Cross-Chain-Bridge-Projec.git
cd Cross-Chain-Bridge-Projec
```

2. Setup environment in `bridge-contracts`:
```bash
cd bridge-contracts
# Create .env file with:
PRIVATE_KEY=0xf0dfaf891e134ee9688ebe7116b508d360fbb2040264fd5da8bd62eb4c64b085
HOLESKY_RPC_URL=https://eth-holesky.g.alchemy.com/v2/SY0uO-6pk-xxfR5g0bZJ4PBO0CaO22P7
TARGET_CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/IQVOAdKJ3tCZBBmZlTchTG43KelVAMe4
ETHERSCAN_API_KEY=58KY1T74HPPR11UUDCAFRAIBXHSBZZ61Z2
HOLESKY_BRIDGE_ADDRESS=0x95A4d51e1a79b21F25dF862240f0786bCf051DA8
TARGET_CHAIN_BRIDGE_ADDRESS=0x84A6ada6B3d7a4D5850F08361Ce6ecbCbD199e3B
HOLESKY_TOKEN_ADDRESS=0x74175129C0f2c42F2d5D0BE94DAE1c0a881018De
TARGET_CHAIN_TOKEN_ADDRESS=0x74175129C0f2c42F2d5D0BE94DAE1c0a881018De
HOLESKY_CONFIRMATION_BLOCKS=15
TARGET_CHAIN_CONFIRMATION_BLOCKS=30
```

3. Setup the indexer:
```bash
cd ../bridge-indexer
npm install
# Create the same .env file as above and add:
DB_PATH=./bridge.db
```

### Run the Bridge

```bash
cd bridge-indexer
npm start
```

### Test the Bridge

1. Approve tokens (already done):
```bash
# On Holesky
cast send --rpc-url $HOLESKY_RPC_URL --private-key $PRIVATE_KEY --etherscan-api-key $ETHERSCAN_API_KEY $HOLESKY_TOKEN_ADDRESS "approve" $HOLESKY_BRIDGE_ADDRESS "1000000000000000000000"

# On Sepolia
cast send --rpc-url $TARGET_CHAIN_RPC_URL --private-key $PRIVATE_KEY --etherscan-api-key $ETHERSCAN_API_KEY $TARGET_CHAIN_TOKEN_ADDRESS "approve" $TARGET_CHAIN_BRIDGE_ADDRESS "1000000000000000000000"
```

2. Deposit tokens:
```bash
# Holesky to Sepolia (1 token)
cast send --rpc-url $HOLESKY_RPC_URL --private-key $PRIVATE_KEY --etherscan-api-key $ETHERSCAN_API_KEY $HOLESKY_BRIDGE_ADDRESS "deposit" $HOLESKY_TOKEN_ADDRESS "1000000000000000000" "0x2d172085765cDdA0A1F353dc2E2e0A4185601DF3"
```

3. Check balance:
```bash
cast call --rpc-url $TARGET_CHAIN_RPC_URL $TARGET_CHAIN_TOKEN_ADDRESS "balanceOf" "0x2d172085765cDdA0A1F353dc2E2e0A4185601DF3"
```

### For Testers

* Address: `0x2d172085765cDdA0A1F353dc2E2e0A4185601DF3`
* Private Key: `0xf0dfaf891e134ee9688ebe7116b508d360fbb2040264fd5da8bd62eb4c64b085`
* Wait 3-5 minutes for transfers to complete (15 confirmations required), if the indexer is started again later, old logs that were pending are showed, to do when it takes a long time to complete 

---

<a name="français"></a>
## 🇫🇷 Français

### Qu'est-ce que ce projet ?

Il s'agit d'un bridge cross-chain qui permet de transférer des tokens entre les réseaux de test Ethereum Holesky et Sepolia.

### Comment ça marche

1. L'utilisateur dépose des tokens sur une chaîne
2. Le bridge détecte le dépôt
3. Le bridge envoie les tokens sur l'autre chaîne

### Adresses des contrats

* **Bridge (Holesky)** : `0x95A4d51e1a79b21F25dF862240f0786bCf051DA8`
* **Bridge (Sepolia)** : `0x84A6ada6B3d7a4D5850F08361Ce6ecbCbD199e3B`
* **Token (Les deux)** : `0x74175129C0f2c42F2d5D0BE94DAE1c0a881018De`

### Installation

1. Cloner le dépôt :
```bash
git clone https://github.com/linadevinci/Cross-Chain-Bridge-Projec.git
cd Cross-Chain-Bridge-Projec
```

2. Configurer l'environnement dans `bridge-contracts` :
```bash
cd bridge-contracts
# Créer un fichier .env avec :
PRIVATE_KEY=0xf0dfaf891e134ee9688ebe7116b508d360fbb2040264fd5da8bd62eb4c64b085
HOLESKY_RPC_URL=https://eth-holesky.g.alchemy.com/v2/SY0uO-6pk-xxfR5g0bZJ4PBO0CaO22P7
TARGET_CHAIN_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/IQVOAdKJ3tCZBBmZlTchTG43KelVAMe4
ETHERSCAN_API_KEY=58KY1T74HPPR11UUDCAFRAIBXHSBZZ61Z2
HOLESKY_BRIDGE_ADDRESS=0x95A4d51e1a79b21F25dF862240f0786bCf051DA8
TARGET_CHAIN_BRIDGE_ADDRESS=0x84A6ada6B3d7a4D5850F08361Ce6ecbCbD199e3B
HOLESKY_TOKEN_ADDRESS=0x74175129C0f2c42F2d5D0BE94DAE1c0a881018De
TARGET_CHAIN_TOKEN_ADDRESS=0x74175129C0f2c42F2d5D0BE94DAE1c0a881018De
HOLESKY_CONFIRMATION_BLOCKS=15
TARGET_CHAIN_CONFIRMATION_BLOCKS=30
```

3. Configurer l'indexeur :
```bash
cd ../bridge-indexer
npm install
# Créer le même fichier .env que ci-dessus et ajouter :
DB_PATH=./bridge.db
```

### Lancer le Bridge

```bash
cd bridge-indexer
npm start
```

### Tester le Bridge

1. Approuver les tokens (c'est déjà fait) :
```bash
# Sur Holesky
cast send --rpc-url $HOLESKY_RPC_URL --private-key $PRIVATE_KEY --etherscan-api-key $ETHERSCAN_API_KEY $HOLESKY_TOKEN_ADDRESS "approve" $HOLESKY_BRIDGE_ADDRESS "1000000000000000000000"

# Sur Sepolia
cast send --rpc-url $TARGET_CHAIN_RPC_URL --private-key $PRIVATE_KEY --etherscan-api-key $ETHERSCAN_API_KEY $TARGET_CHAIN_TOKEN_ADDRESS "approve" $TARGET_CHAIN_BRIDGE_ADDRESS "1000000000000000000000"
```

2. Déposer des tokens :
```bash
# Holesky vers Sepolia (1 token)
cast send --rpc-url $HOLESKY_RPC_URL --private-key $PRIVATE_KEY --etherscan-api-key $ETHERSCAN_API_KEY $HOLESKY_BRIDGE_ADDRESS "deposit" $HOLESKY_TOKEN_ADDRESS "1000000000000000000" "0x2d172085765cDdA0A1F353dc2E2e0A4185601DF3"
```

3. Vérifier le solde :
```bash
cast call --rpc-url $TARGET_CHAIN_RPC_URL $TARGET_CHAIN_TOKEN_ADDRESS "balanceOf" "0x2d172085765cDdA0A1F353dc2E2e0A4185601DF3"
```

### Pour les Testeurs

* Adresse : `0x2d172085765cDdA0A1F353dc2E2e0A4185601DF3`
* Clé Privée : `0xf0dfaf891e134ee9688ebe7116b508d360fbb2040264fd5da8bd62eb4c64b085`
* Attendez 3-5 minutes pour que les transferts se terminent (15 confirmations requises), si l'indexeur est relancé on peut voir les actions faites precedemments, à faire si c'est long
