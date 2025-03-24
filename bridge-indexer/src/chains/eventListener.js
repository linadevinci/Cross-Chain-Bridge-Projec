const { ethers } = require('ethers');
const { BRIDGE_ABI } = require('../utils/abi');
const { depositRepository } = require('../db/database');
const logger = require('../utils/logger');
require('dotenv').config();

class EventListener {
  constructor(chainName, rpcUrl, bridgeAddress, confirmationBlocks) {
    this.chainName = chainName;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.bridgeAddress = bridgeAddress;
    this.confirmationBlocks = confirmationBlocks;
    this.bridgeContract = new ethers.Contract(bridgeAddress, BRIDGE_ABI, this.provider);
    
    // Map pour suivre les événements déjà traités
    this.processedEvents = new Map();
    
    logger.info(`EventListener initialized for ${chainName}. Bridge address: ${bridgeAddress}`);
  }



  // Démarrer l'écoute des événements Deposit

  async startListening() {
    try {
      logger.info(`Starting to listen for Deposit events on ${this.chainName}`);
  
      // Poll for new events every 10 seconds
      setInterval(async () => {
        const currentBlock = await this.provider.getBlockNumber();
        const fromBlock = currentBlock - 10; // Check the last 10 blocks
  
        // Query for Deposit events
        const filter = this.bridgeContract.filters.Deposit();
        const events = await this.bridgeContract.queryFilter(filter, fromBlock, currentBlock);
  
        for (const event of events) {
          const eventKey = `${event.transactionHash}-${event.logIndex}`;
  
          // Avoid processing the same event multiple times
          if (this.processedEvents.has(eventKey)) {
            continue;
          }
          this.processedEvents.set(eventKey, true);
  
          logger.info(`New Deposit event detected on ${this.chainName}: Token=${event.args.token}, From=${event.args.from}, To=${event.args.to}, Amount=${event.args.amount}, Nonce=${event.args.nonce}`);
  
          // Save the deposit to the database
          const block = await event.getBlock();
          const deposit = {
            txHash: event.transactionHash,
            chainName: this.chainName,
            tokenAddress: event.args.token,
            fromAddress: event.args.from,
            toAddress: event.args.to,
            amount: event.args.amount,
            nonce: Number(event.args.nonce),
            blockNumber: event.blockNumber,
            timestamp: block.timestamp,
            status: 'pending'
          };
  
          try {
            depositRepository.saveDeposit(deposit);
            logger.info(`Deposit saved to database: ${this.chainName}, Nonce=${deposit.nonce}`);
  
            // Wait for confirmations
            this.waitForConfirmations(deposit);
          } catch (error) {
            logger.error(`Error saving deposit: ${error.message}`);
          }
        }
      }, 10000); // Poll every 10 seconds
  
      logger.info(`Successfully started polling for Deposit events on ${this.chainName}`);
    } catch (error) {
      logger.error(`Error starting event listener for ${this.chainName}: ${error.message}`);
      throw error;
    }
  }
  
  
  // Attendre le nombre requis de confirmations
  // Attendre le nombre requis de confirmations
  async waitForConfirmations(deposit) {
    try {
      logger.info(`Waiting for ${this.confirmationBlocks} confirmations for tx ${deposit.txHash} on ${this.chainName}`);
      
      // Attendre le nombre requis de confirmations
      await this.provider.waitForTransaction(deposit.txHash, this.confirmationBlocks);

      // S'assurer que les types sont corrects avant de les passer à SQLite
      const chainName = String(this.chainName);
      const nonce = Number(deposit.nonce);
      const status = 'confirmed';
      
      // Mettre à jour le statut du dépôt
      depositRepository.updateDepositStatus(chainName, nonce, status);
      logger.info(`Deposit confirmed with ${this.confirmationBlocks} confirmations: ${chainName}, Nonce=${nonce}`);
    } catch (error) {
      logger.error(`Error waiting for confirmations: ${error.message}`);
      // Même lors de la gestion des erreurs, assurons-nous que les types sont corrects
      try {
        const chainName = String(this.chainName);
        const nonce = Number(deposit.nonce);
        const status = 'failed';
        depositRepository.updateDepositStatus(chainName, nonce, status);
      } catch (innerError) {
        logger.error(`Error updating deposit status: ${innerError.message}`);
      }
      // Retry après un délai
      setTimeout(() => this.waitForConfirmations(deposit), 10000); // Retry après 10 secondes
      }
  }

  
  
  
  // Vérifier manuellement les événements passés (utile pour récupérer les événements manqués)


  async checkPastEvents(fromBlock, toBlock) {
    try {
      logger.info(`Checking past Deposit events from block ${fromBlock} to ${toBlock} on ${this.chainName}`);
      
      const batchSize = 500; // Limitation d'Alchemy
      let processedEvents = 0;
      
      // Traiter par lots de 500 blocs
      for (let currentFrom = fromBlock; currentFrom < toBlock; currentFrom += batchSize) {
        const currentTo = Math.min(currentFrom + batchSize - 1, toBlock);
        
        logger.info(`Checking batch from block ${currentFrom} to ${currentTo} on ${this.chainName}`);
        
        const filter = this.bridgeContract.filters.Deposit();
        const events = await this.bridgeContract.queryFilter(filter, currentFrom, currentTo);
        
        processedEvents += events.length;
        
        logger.info(`Found ${events.length} past Deposit events in batch on ${this.chainName}`);
        
        // Traitement des événements (code existant)
        for (const event of events) {
          // ... votre code existant
        }
      }
      
      logger.info(`Found ${processedEvents} total past Deposit events on ${this.chainName}`);
    } catch (error) {
      logger.error(`Error checking past events: ${error.message}`);
      throw error;
    }
  }

  
  
  // Obtenir le contrat bridge
  getBridgeContract() {
    return this.bridgeContract;
  }
  
  // Obtenir le provider
  getProvider() {
    return this.provider;
  }
}

module.exports = EventListener;