// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "../src/TestToken.sol";

contract DeployTestToken is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Déploiement du token de test
        // Vous pouvez modifier les paramètres selon votre TestToken.sol
        // Par exemple: nom, symbole, offre initiale
        TestToken token = new TestToken(); // 1 million de tokens avec 18 décimales
        
        console.log("TestToken deployed at address:", address(token));
        
        vm.stopBroadcast();
    }
}