require('dotenv').config();
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const EventListener = require('./chains/eventListener');
const TransactionHandler = require('./handlers/transactionHandler');
const database = require('./db/database');
const logger = require('./utils/logger');

// Création du dossier logs s'il n'existe pas
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Initialiser la base de données
database.initializeDatabase();

// Vérifier que les variables d'environnement sont chargées
console.log("Vérification des variables d'environnement:");
console.log("HOLESKY_RPC_URL:", process.env.HOLESKY_RPC_URL ? "✓" : "⨯");
console.log("TARGET_CHAIN_RPC_URL:", process.env.TARGET_CHAIN_RPC_URL ? "✓" : "⨯");
console.log("HOLESKY_BRIDGE_ADDRESS:", process.env.HOLESKY_BRIDGE_ADDRESS ? "✓" : "⨯");
console.log("TARGET_CHAIN_BRIDGE_ADDRESS:", process.env.TARGET_CHAIN_BRIDGE_ADDRESS ? "✓" : "⨯");
console.log("PRIVATE_KEY:", process.env.PRIVATE_KEY ? "✓" : "⨯");

// Configuration des chaînes avec valeurs par défaut si les variables d'environnement ne sont pas définies
const holeskyConfig = {
  name: 'holesky',
  rpcUrl: process.env.HOLESKY_RPC_URL || 'https://eth-holesky.g.alchemy.com/v2/SY0uO-6pk-xxfR5g0bZJ4PBO0CaO22P7',
  bridgeAddress: process.env.HOLESKY_BRIDGE_ADDRESS || '0x95A4d51e1a79b21F25dF862240f0786bCf051DA8',
  confirmationBlocks: parseInt(process.env.HOLESKY_CONFIRMATION_BLOCKS || '15')
};

const targetChainConfig = {
  name: 'sepolia',
  rpcUrl: process.env.TARGET_CHAIN_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/IQVOAdKJ3tCZBBmZlTchTG43KelVAMe4',
  bridgeAddress: process.env.TARGET_CHAIN_BRIDGE_ADDRESS || '0x84A6ada6B3d7a4D5850F08361Ce6ecbCbD199e3B',
  confirmationBlocks: parseInt(process.env.TARGET_CHAIN_CONFIRMATION_BLOCKS || '30')
};

console.log("Configuration des chaînes:");
console.log("Holesky:", holeskyConfig);
console.log("Target Chain:", targetChainConfig);

// Initialisation des écouteurs d'événements
const holeskyListener = new EventListener(
  holeskyConfig.name,
  holeskyConfig.rpcUrl,
  holeskyConfig.bridgeAddress,
  holeskyConfig.confirmationBlocks
);

const targetChainListener = new EventListener(
  targetChainConfig.name,
  targetChainConfig.rpcUrl,
  targetChainConfig.bridgeAddress,
  targetChainConfig.confirmationBlocks
);

// Initialisation des gestionnaires de transactions
const holeskyToTargetHandler = new TransactionHandler(
  holeskyConfig.name,
  targetChainConfig.name,
  holeskyConfig.rpcUrl,
  targetChainConfig.rpcUrl,
  holeskyConfig.bridgeAddress,
  targetChainConfig.bridgeAddress
);

const targetToHoleskyHandler = new TransactionHandler(
  targetChainConfig.name,
  holeskyConfig.name,
  targetChainConfig.rpcUrl,
  holeskyConfig.rpcUrl,
  targetChainConfig.bridgeAddress,
  holeskyConfig.bridgeAddress
);

// Démarrer les écouteurs d'événements
async function startEventListeners() {
  try {
    await holeskyListener.startListening();
    await targetChainListener.startListening();
    logger.info('Event listeners started successfully');
  } catch (error) {
    logger.error(`Error starting event listeners: ${error.message}`);
    process.exit(1);
  }
}

// Vérifier les événements passés (utile au démarrage ou après un arrêt)
async function checkPastEvents() {
  try {
    // Récupérer les derniers blocs
    const holeskyProvider = holeskyListener.getProvider();
    const targetProvider = targetChainListener.getProvider();
    
    const holeskyCurrentBlock = await holeskyProvider.getBlockNumber();
    const targetCurrentBlock = await targetProvider.getBlockNumber();
    
    // On vérifie les 5000 derniers blocs (environ 1 jour pour Ethereum)
    const holeskyFromBlock = Math.max(0, holeskyCurrentBlock - 5000);
    const targetFromBlock = Math.max(0, targetCurrentBlock - 5000);
    
    logger.info(`Checking past events on Holesky from block ${holeskyFromBlock} to ${holeskyCurrentBlock}`);
    await holeskyListener.checkPastEvents(holeskyFromBlock, holeskyCurrentBlock);
    
    logger.info(`Checking past events on Target Chain from block ${targetFromBlock} to ${targetCurrentBlock}`);
    await targetChainListener.checkPastEvents(targetFromBlock, targetCurrentBlock);
    
    logger.info('Past events checked successfully');
  } catch (error) {
    logger.error(`Error checking past events: ${error.message}`);
  }
}

// Traiter les dépôts non traités
async function processDeposits() {
  try {
    await holeskyToTargetHandler.processUnprocessedDeposits();
    await targetToHoleskyHandler.processUnprocessedDeposits();
    logger.info('Unprocessed deposits processed successfully');
  } catch (error) {
    logger.error(`Error processing deposits: ${error.message}`);
  }
}

// Vérifier les transactions en attente
async function checkPendingTransactions() {
  try {
    await holeskyToTargetHandler.checkPendingTransactions();
    await targetToHoleskyHandler.checkPendingTransactions();
    logger.info('Pending transactions checked successfully');
  } catch (error) {
    logger.error(`Error checking pending transactions: ${error.message}`);
  }
}

// Fonction principale
async function main() {
  try {
    logger.info('Starting bridge indexer...');
    
    // Démarrer les écouteurs d'événements
    await startEventListeners();
    
    // Vérifier les événements passés au démarrage
    await checkPastEvents();
    
    // Planifier les tâches périodiques
    
    // Vérifier les dépôts non traités toutes les 2 minutes
    cron.schedule('*/0.5 * * * *', async () => {
      logger.info('Running scheduled task: Process unprocessed deposits');
      await processDeposits();
    });
    
    // Vérifier les transactions en attente toutes les 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      logger.info('Running scheduled task: Check pending transactions');
      await checkPendingTransactions();
    });
    
    // Vérifier les événements passés toutes les heures (utile en cas de problème temporaire)
    cron.schedule('0 * * * *', async () => {
      logger.info('Running scheduled task: Check past events');
      await checkPastEvents();
    });
    
    logger.info('Bridge indexer started successfully');
  } catch (error) {
    logger.error(`Error in main function: ${error.message}`);
    process.exit(1);
  }
}

// Gestionnaire d'arrêt propre
process.on('SIGINT', () => {
  logger.info('Received SIGINT. Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM. Shutting down...');
  process.exit(0);
});

// Démarrer l'application
main().catch(error => {
  logger.error(`Unhandled error: ${error.message}`);
  process.exit(1);
});