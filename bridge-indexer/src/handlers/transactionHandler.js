const { ethers } = require('ethers');
const { BRIDGE_ABI } = require('../utils/abi');
const { depositRepository, distributionRepository, pendingTxRepository } = require('../db/database');
const logger = require('../utils/logger');
require('dotenv').config();

class TransactionHandler {
  constructor(sourceName, targetName, sourceRpcUrl, targetRpcUrl, sourceBridgeAddress, targetBridgeAddress) {
    this.sourceName = sourceName;
    this.targetName = targetName;
    
    // Configuration des providers et wallet
    //this.sourceProvider = new ethers.JsonRpcProvider(sourceRpcUrl);
    //this.targetProvider = new ethers.JsonRpcProvider(targetRpcUrl);
    this.sourceProvider = new ethers.JsonRpcProvider(sourceRpcUrl);
    this.targetProvider = new ethers.JsonRpcProvider(targetRpcUrl);

    const privateKeyRaw = process.env.PRIVATE_KEY || "f0dfaf891e134ee9688ebe7116b508d360fbb2040264fd5da8bd62eb4c64b085";
    const privateKey = privateKeyRaw.startsWith("0x") ? privateKeyRaw.substring(2) : privateKeyRaw;
    
    try {
        const wallet = new ethers.Wallet(privateKey);
        this.sourceWallet = wallet.connect(this.sourceProvider);
        this.targetWallet = wallet.connect(this.targetProvider);
        console.log("Wallet correctement initialisé avec l'adresse:", wallet.address);
    } catch (error) {
        console.error("Erreur lors de l'initialisation du wallet:", error.message);
        throw error;
    }

    // Initialisation des contrats
    this.sourceBridgeContract = new ethers.Contract(sourceBridgeAddress, BRIDGE_ABI, this.sourceWallet);
    this.targetBridgeContract = new ethers.Contract(targetBridgeAddress, BRIDGE_ABI, this.targetWallet);
    
    logger.info(`TransactionHandler initialized for ${sourceName} -> ${targetName}`);
  }
  
  // Traiter les dépôts non traités
  async processUnprocessedDeposits() {
    try {
      // Obtenir les dépôts confirmés mais non traités pour la chaîne source
      const unprocessedDeposits = depositRepository.getUnprocessedDeposits(this.sourceName);
      logger.info(`Found ${unprocessedDeposits.length} unprocessed deposits on ${this.sourceName}`);
      
      for (const deposit of unprocessedDeposits) {
        await this.processDeposit(deposit);
      }
    } catch (error) {
      logger.error(`Error processing unprocessed deposits: ${error.message}`);
    }
  }
  
  // Traiter un dépôt spécifique
  async processDeposit(deposit) {
    try {
      logger.info(`Processing deposit: Chain=${deposit.chain_name}, Nonce=${deposit.nonce}`);
      
      // Vérifier si une distribution a déjà été effectuée pour ce dépôt
      const existingDistribution = distributionRepository.getDistribution(this.targetName, deposit.nonce);
      if (existingDistribution) {
        logger.info(`Distribution already processed for Nonce=${deposit.nonce}`);
        depositRepository.markAsProcessed(deposit.id);
        return;
      }
      
      // Effectuer la distribution sur la chaîne cible
      const tx = await this.targetBridgeContract.distribute(
        deposit.token_address,
        deposit.to_address,
        BigInt(deposit.amount),
        deposit.nonce
      );
      
      logger.info(`Distribution transaction sent: ${tx.hash}`);
      
      // Enregistrer la transaction en attente
      pendingTxRepository.savePendingTx({
        txHash: tx.hash,
        chainName: this.targetName,
        nonce: deposit.nonce
      });
      
      // Attendre la confirmation de la transaction
      const receipt = await tx.wait();
      
      if (receipt.status === 1) {
        logger.info(`Distribution successful: TxHash=${tx.hash}`);
        
        // Enregistrer la distribution
        const block = await this.targetProvider.getBlock(receipt.blockNumber);
        distributionRepository.saveDistribution({
          txHash: tx.hash,
          chainName: this.targetName,
          tokenAddress: deposit.token_address,
          toAddress: deposit.to_address,
          amount: deposit.amount,
          nonce: deposit.nonce,
          blockNumber: receipt.blockNumber,
          timestamp: block.timestamp,
          status: 'success'
        });
        
        // Marquer le dépôt comme traité
        depositRepository.markAsProcessed(deposit.id);
        
        // Mettre à jour le statut de la transaction en attente
        pendingTxRepository.updateTxStatus(tx.hash, 'success');
      } else {
        logger.error(`Distribution failed: TxHash=${tx.hash}`);
        pendingTxRepository.updateTxStatus(tx.hash, 'failed');
      }
    } catch (error) {
      logger.error(`Error processing deposit: ${error.message}`);
      
      // Si l'erreur indique que le dépôt a déjà été traité, marquer comme traité
      if (error.message.includes('deposit already processed')) {
        logger.info(`Deposit already processed: Nonce=${deposit.nonce}`);
        depositRepository.markAsProcessed(deposit.id);
      }
    }
  }
  
  // Vérifier les transactions en attente
  async checkPendingTransactions() {
    try {
      const pendingTxs = pendingTxRepository.getPendingTransactions();
      logger.info(`Checking ${pendingTxs.length} pending transactions`);
      
      for (const tx of pendingTxs) {
        try {
          // Obtenir le fournisseur approprié
          const provider = tx.chain_name === this.sourceName ? this.sourceProvider : this.targetProvider;
          
          // Vérifier le statut de la transaction
          const receipt = await provider.getTransactionReceipt(tx.tx_hash);
          
          if (receipt) {
            if (receipt.status === 1) {
              logger.info(`Transaction confirmed: ${tx.tx_hash}`);
              pendingTxRepository.updateTxStatus(tx.tx_hash, 'success');
              
              // Si c'est une transaction de distribution, enregistrer la distribution
              if (tx.chain_name === this.targetName) {
                const deposit = depositRepository.getDeposit(this.sourceName, tx.nonce);
                if (deposit) {
                  const block = await provider.getBlock(receipt.blockNumber);
                  
                  distributionRepository.saveDistribution({
                    txHash: tx.tx_hash,
                    chainName: this.targetName,
                    tokenAddress: deposit.token_address,
                    toAddress: deposit.to_address,
                    amount: deposit.amount,
                    nonce: deposit.nonce,
                    blockNumber: receipt.blockNumber,
                    timestamp: block.timestamp,
                    status: 'success'
                  });
                  
                  depositRepository.markAsProcessed(deposit.id);
                }
              }
            } else {
              logger.error(`Transaction failed: ${tx.tx_hash}`);
              pendingTxRepository.updateTxStatus(tx.tx_hash, 'failed');
            }
          } else {
            // Si la transaction est en attente depuis plus de 1 heure, la considérer comme échouée
            const currentTime = Date.now();
            const txAge = currentTime - tx.created_at;
            
            if (txAge > 3600000) { // 1 heure en millisecondes
              logger.error(`Transaction timed out: ${tx.tx_hash}`);
              pendingTxRepository.updateTxStatus(tx.tx_hash, 'timeout');
            }
          }
        } catch (error) {
          logger.error(`Error checking transaction ${tx.tx_hash}: ${error.message}`);
        }
      }
    } catch (error) {
      logger.error(`Error checking pending transactions: ${error.message}`);
    }
  }
}

module.exports = TransactionHandler;