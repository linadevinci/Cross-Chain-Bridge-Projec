const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

// Chemin de la base de données
const dbPath = process.env.DB_PATH || path.join(__dirname, '../../bridge.db');

// Initialiser la base de données
const db = new Database(dbPath);

// Créer les tables nécessaires si elles n'existent pas
function initializeDatabase() {
  // Table pour stocker les événements de dépôt
  db.exec(`
    CREATE TABLE IF NOT EXISTS deposits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT NOT NULL,
      chain_name TEXT NOT NULL,
      token_address TEXT NOT NULL,
      from_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      processed BOOLEAN DEFAULT FALSE,
      UNIQUE(chain_name, nonce)
    )
  `);

  // Table pour stocker les événements de distribution
  db.exec(`
    CREATE TABLE IF NOT EXISTS distributions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT NOT NULL,
      chain_name TEXT NOT NULL,
      token_address TEXT NOT NULL,
      to_address TEXT NOT NULL,
      amount TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      block_number INTEGER NOT NULL,
      timestamp INTEGER NOT NULL,
      status TEXT DEFAULT 'success',
      UNIQUE(chain_name, nonce)
    )
  `);

  // Table pour stocker les transactions en cours
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tx_hash TEXT NOT NULL UNIQUE,
      chain_name TEXT NOT NULL,
      nonce INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      status TEXT DEFAULT 'pending'
    )
  `);

  console.log('Database initialized');
}

// Méthodes pour interagir avec la table des dépôts
const depositRepository = {
  saveDeposit: (deposit) => {
    const stmt = db.prepare(`
      INSERT INTO deposits 
      (tx_hash, chain_name, token_address, from_address, to_address, amount, nonce, block_number, timestamp, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      return stmt.run(
        deposit.txHash,
        deposit.chainName,
        deposit.tokenAddress,
        deposit.fromAddress,
        deposit.toAddress,
        deposit.amount.toString(),
        deposit.nonce,
        deposit.blockNumber,
        deposit.timestamp,
        deposit.status || 'pending'
      );
    } catch (error) {
      // Si l'enregistrement existe déjà, on l'ignore
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        console.log(`Deposit already exists for ${deposit.chainName} with nonce ${deposit.nonce}`);
        return null;
      }
      throw error;
    }
  },
  
  updateDepositStatus: (chainName, nonce, status) => {
    try {
      // Convertir en types sûrs pour SQLite
      const safeChainName = String(chainName);
      const safeNonce = Number(nonce);
      const safeStatus = String(status);
      const isProcessed = status === 'confirmed' ? 1 : 0; // Convert boolean to number
      
      const stmt = db.prepare(`
        UPDATE deposits 
        SET status = ?, processed = ?
        WHERE chain_name = ? AND nonce = ?
      `);
      
      return stmt.run(
        safeStatus,
        isProcessed, // Pass as a number (1 or 0)
        safeChainName,
        safeNonce
      );
    } catch (error) {
      console.error(`Error updating deposit status: ${error.message}`);
      throw error;
    }
  },
  
    
  getDeposit: (chainName, nonce) => {
    const stmt = db.prepare(`
      SELECT * FROM deposits
      WHERE chain_name = ? AND nonce = ?
    `);
    
    return stmt.get(chainName, nonce);
  },
  
  getUnprocessedDeposits: (chainName) => {
    const stmt = db.prepare(`
      SELECT * FROM deposits
      WHERE chain_name = ? AND processed = FALSE AND status = 'confirmed'
    `);
    
    return stmt.all(chainName);
  },
  
  markAsProcessed: (id) => {
    const stmt = db.prepare(`
      UPDATE deposits
      SET processed = TRUE
      WHERE id = ?
    `);
    
    return stmt.run(id);
  }
};

// Méthodes pour interagir avec la table des distributions
const distributionRepository = {
  saveDistribution: (distribution) => {
    const stmt = db.prepare(`
      INSERT INTO distributions 
      (tx_hash, chain_name, token_address, to_address, amount, nonce, block_number, timestamp, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    try {
      return stmt.run(
        distribution.txHash,
        distribution.chainName,
        distribution.tokenAddress,
        distribution.toAddress,
        distribution.amount.toString(),
        distribution.nonce,
        distribution.blockNumber,
        distribution.timestamp,
        distribution.status || 'success'
      );
    } catch (error) {
      // Si l'enregistrement existe déjà, on l'ignore
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        console.log(`Distribution already exists for ${distribution.chainName} with nonce ${distribution.nonce}`);
        return null;
      }
      throw error;
    }
  },
  
  getDistribution: (chainName, nonce) => {
    const stmt = db.prepare(`
      SELECT * FROM distributions
      WHERE chain_name = ? AND nonce = ?
    `);
    
    return stmt.get(chainName, nonce);
  }
};

// Méthodes pour interagir avec la table des transactions en attente
const pendingTxRepository = {
  savePendingTx: (tx) => {
    const stmt = db.prepare(`
      INSERT INTO pending_transactions 
      (tx_hash, chain_name, nonce, created_at, status) 
      VALUES (?, ?, ?, ?, ?)
    `);
    
    try {
      return stmt.run(
        tx.txHash,
        tx.chainName,
        tx.nonce,
        Date.now(),
        'pending'
      );
    } catch (error) {
      // Si l'enregistrement existe déjà, on l'ignore
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        console.log(`Transaction already pending: ${tx.txHash}`);
        return null;
      }
      throw error;
    }
  },
  
  updateTxStatus: (txHash, status) => {
    const stmt = db.prepare(`
      UPDATE pending_transactions
      SET status = ?
      WHERE tx_hash = ?
    `);
    
    return stmt.run(status, txHash);
  },
  
  getPendingTransactions: () => {
    const stmt = db.prepare(`
      SELECT * FROM pending_transactions
      WHERE status = 'pending'
    `);
    
    return stmt.all();
  }
};

module.exports = {
  initializeDatabase,
  depositRepository,
  distributionRepository,
  pendingTxRepository,
  db
};