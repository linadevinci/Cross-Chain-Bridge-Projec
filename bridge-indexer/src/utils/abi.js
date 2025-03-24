// ABI du contrat TokenBridge
const BRIDGE_ABI = [
    // Events
    "event Deposit(address indexed token, address indexed from, address indexed to, uint256 amount, uint256 nonce)",
    "event Distribution(address indexed token, address indexed to, uint256 amount, uint256 nonce)",
    
    // Functions
    "function addSupportedToken(address token) external",
    "function deposit(address token, uint256 amount, address recipient) external",
    "function distribute(address token, address recipient, uint256 amount, uint256 depositNonce) external",
    "function emergencyWithdraw(address token, uint256 amount) external"
  ];
  
  // ABI d'un token ERC20 standard
  const ERC20_ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)",
    "function balanceOf(address) view returns (uint256)",
    "function transfer(address to, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function approve(address spender, uint amount) returns (bool)",
    "function transferFrom(address from, address to, uint amount) returns (bool)",
    "event Transfer(address indexed from, address indexed to, uint amount)",
    "event Approval(address indexed owner, address indexed spender, uint amount)"
  ];
  
  module.exports = {
    BRIDGE_ABI,
    ERC20_ABI
  };