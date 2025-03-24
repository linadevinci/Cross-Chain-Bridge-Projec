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
      
      // Écouter les nouveaux événements Deposit
      this.bridgeContract.on("Deposit", async (token, from, to, amount, nonce, event) => {
        const eventKey = `${event.log.transactionHash}-${event.log.index}`;
        
        // Éviter de traiter le même événement plusieurs fois
        if (this.processedEvents.has(eventKey)) {
          return;
        }
        this.processedEvents.set(eventKey, true);
        
        logger.info(`New Deposit event detected on ${this.chainName}: Token=${token}, From=${from}, To=${to}, Amount=${amount}, Nonce=${nonce}`);
        
        // Enregistrer le dépôt dans la base de données
        const block = await event.getBlock();
        const deposit = {
          txHash: event.log.transactionHash,
          chainName: this.chainName,
          tokenAddress: token,
          fromAddress: from,
          toAddress: to,
          amount: amount,
          nonce: Number(nonce),
          blockNumber: event.log.blockNumber,
          timestamp: block.timestamp,
          status: 'pending'
        };
        
        try {
          depositRepository.saveDeposit(deposit);
          logger.info(`Deposit saved to database: ${this.chainName}, Nonce=${nonce}`);
          
          // Vérifier les confirmations
          this.waitForConfirmations(deposit);
        } catch (error) {
          logger.error(`Error saving deposit: ${error.message}`);
        }
      });
      
      logger.info(`Successfully subscribed to Deposit events on ${this.chainName}`);
    } catch (error) {
      logger.error(`Error starting event listener for ${this.chainName}: ${error.message}`);
      throw error;
    }
  }
  
  // Attendre le nombre requis de confirmations
  async waitForConfirmations(deposit) {
    try {
      logger.info(`Waiting for ${this.confirmationBlocks} confirmations for tx ${deposit.txHash} on ${this.chainName}`);
      
      // Attendre le nombre requis de confirmations
      await this.provider.waitForTransaction(deposit.txHash, this.confirmationBlocks);
      
      // Mettre à jour le statut du dépôt
      depositRepository.updateDepositStatus(this.chainName, deposit.nonce, 'confirmed');
      logger.info(`Deposit confirmed with ${this.confirmationBlocks} confirmations: ${this.chainName}, Nonce=${deposit.nonce}`);
    } catch (error) {
      logger.error(`Error waiting for confirmations: ${error.message}`);
      depositRepository.updateDepositStatus(this.chainName, deposit.nonce, 'failed');
    }
  }
  
  // Vérifier manuellement les événements passés (utile pour récupérer les événements manqués)
  async checkPastEvents(fromBlock, toBlock) {
    try {
      logger.info(`Checking past Deposit events from block ${fromBlock} to ${toBlock} on ${this.chainName}`);
      
      const filter = this.bridgeContract.filters.Deposit();
      const events = await this.bridgeContract.queryFilter(filter, fromBlock, toBlock);
      
      logger.info(`Found ${events.length} past Deposit events on ${this.chainName}`);
      
      for (const event of events) {
        const [token, from, to, amount, nonce] = event.args;
        
        logger.info(`Processing past Deposit event: Token=${token}, From=${from}, To=${to}, Amount=${amount}, Nonce=${nonce}`);
        
        const block = await this.provider.getBlock(event.blockNumber);
        const deposit = {
          txHash: event.transactionHash,
          chainName: this.chainName,
          tokenAddress: token,
          fromAddress: from,
          toAddress: to,
          amount: amount,
          nonce: Number(nonce),
          blockNumber: event.blockNumber,
          timestamp: block.timestamp,
          status: 'pending'
        };
        
        try {
          depositRepository.saveDeposit(deposit);
          
          // Vérifier si le bloc a suffisamment de confirmations
          const currentBlock = await this.provider.getBlockNumber();
          const confirmations = currentBlock - event.blockNumber;
          
          if (confirmations >= this.confirmationBlocks) {
            depositRepository.updateDepositStatus(this.chainName, deposit.nonce, 'confirmed');
            logger.info(`Past deposit already confirmed: ${this.chainName}, Nonce=${nonce}`);
          } else {
            this.waitForConfirmations(deposit);
          }
        } catch (error) {
          // Si l'erreur est due à une contrainte d'unicité, cela signifie que le dépôt est déjà enregistré
          if (!error.message.includes('UNIQUE constraint failed')) {
            logger.error(`Error processing past deposit: ${error.message}`);
          }
        }
      }
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