============================================================
# REQUIREMENTS & SETUP GUIDE
# Peer-to-Peer Energy Trading Smart Contract
# Module: COMP5125M Blockchain Technologies
# ============================================================

# NOTE: This is a Node.js project, not Python.
# Dependencies are managed via npm (Node Package Manager).
# The equivalent of requirements.txt for Node.js is package.json.
# All dependencies below are installed via npm commands.

# ============================================================
# SYSTEM REQUIREMENTS
# ============================================================

Node.js     >= 22.x.x   (LTS version)
npm         >= 8.x.x    (comes with Node.js)
nvm                     (Node Version Manager - recommended)

# ============================================================
# PROJECT DEPENDENCIES (package.json)
# ============================================================

# Development Dependencies:
hardhat                                 @2.22.17
@nomicfoundation/hardhat-toolbox        @5.0.0
ethers                                  @6.x.x   (installed with toolbox)
chai                                    @4.x.x   (installed with toolbox)
mocha                                   @x.x.x   (installed with toolbox)

# ============================================================
# STEP-BY-STEP SETUP COMMANDS
# ============================================================

# ---- STEP 1: Install Node Version Manager (nvm) ----
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Activate nvm (or restart terminal)
export NVM_DIR="$HOME/.nvm"
source "$HOME/.nvm/nvm.sh"

# ---- STEP 2: Install Node.js v22 ----
nvm install 22
nvm use 22

# Verify Node version
node --version    # should show v22.x.x
npm --version     # should show 8.x.x or higher

# ---- STEP 3: Create Project Folder ----
mkdir energy-trading
cd energy-trading
npm init -y

# ---- STEP 4: Install Hardhat ----
npm install --save-dev hardhat@2.22.17

# ---- STEP 5: Install Hardhat Toolbox (includes ethers, chai, mocha) ----
npm install --save-dev @nomicfoundation/hardhat-toolbox@5.0.0

# ---- STEP 6: Create Project Folder Structure ----
mkdir contracts
mkdir test
mkdir scripts

# ---- STEP 7: Create hardhat.config.js ----
# Create the file and paste the following content:
#
# require("@nomicfoundation/hardhat-toolbox");
# module.exports = {
#   solidity: "0.8.19",
# };

# ---- STEP 8: Add Smart Contract ----
# Copy contract file into contracts folder:
cp path/to/contract.sol contracts/contract.sol

# OR create manually:
nano contracts/contract.sol
# paste contract code → Ctrl+X → Y → Enter

# ---- STEP 9: Add Test File ----
# Copy university test file into test folder:
cp path/to/basic_contract_tests.js test/basic_contract_tests.js

# OR create manually:
nano test/basic_contract_tests.js
# paste test code → Ctrl+X → Y → Enter

# ---- STEP 10: Compile the Smart Contract ----
npx hardhat compile

# Expected output:
# Compiled 1 Solidity file successfully (evm target: paris).

# ---- STEP 11: Run Tests ----
npx hardhat test

# Expected output:
#   EnergyTrading basic tests
#     ✔ Should deploy with correct recorder address
#     ✔ Should allow prosumers to register and have correct initial state
#     ✔ Should allow a registered prosumer to deposit Ethers
#     ✔ Should allow recorder to update energy status of prosumers
#   4 passing (1s)

# ---- STEP 12: Run Specific Test File ----
npx hardhat test test/basic_contract_tests.js

# ---- STEP 13: Check Contract Size ----
npx hardhat compile --show-stack-traces
# No size warning = contract is under 24,576 byte limit ✅

# ---- STEP 14: Clean Build Artifacts (if needed) ----
npx hardhat clean

# ---- STEP 15: Check All Installed Packages ----
npm list --depth=0

# ============================================================
# QUICK START (All commands in one block)
# ============================================================

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
export NVM_DIR="$HOME/.nvm" && source "$HOME/.nvm/nvm.sh"
nvm install 22 && nvm use 22
mkdir energy-trading && cd energy-trading
npm init -y
npm install --save-dev hardhat@2.22.17
npm install --save-dev @nomicfoundation/hardhat-toolbox@5.0.0
mkdir contracts test scripts
npx hardhat compile
npx hardhat test

# ============================================================
# TROUBLESHOOTING
# ============================================================

# Problem: nvm command not found
# Solution:
source ~/.bashrc
# or
source ~/.nvm/nvm.sh

# Problem: ethers.parseEther is not a function
# Cause: Using ethers v5 instead of v6
# Solution: Reinstall with correct version
npm install --save-dev @nomicfoundation/hardhat-toolbox@5.0.0

# Problem: Cannot find module 'chai'
# Solution:
npm install --save-dev chai@4.3.7 --legacy-peer-deps

# Problem: ERESOLVE dependency conflict
# Solution:
npm install --legacy-peer-deps

# Problem: Node version not supported warning
# Solution:
nvm install 22 && nvm use 22

# Problem: Contract size exceeds 24576 bytes
# Solution: Clean and recompile
npx hardhat clean && npx hardhat compile

# Problem: Port already in use
# Solution:
npx hardhat node --port 8546

# ============================================================
# FILE STRUCTURE (Final Project Layout)
# ============================================================

energy-trading/
├── contracts/
│   └── contract.sol              ← Smart contract
├── test/
│   └── basic_contract_tests.js   ← Test cases
├── scripts/                      ← Deployment scripts (optional)
├── artifacts/                    ← Auto-generated after compile
├── cache/                        ← Auto-generated after compile
├── hardhat.config.js             ← Hardhat configuration
├── package.json                  ← Project dependencies
├── package-lock.json             ← Dependency lock file
└── requirements.txt              ← This file

# ============================================================
# SUBMISSION FILES (Gradescope)
# ============================================================

Firstname-Surname-contract.sol    ← Rename with your actual name
Firstname-Surname-readme.md       ← Rename with your actual name
