// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.0;

contract EnergyTrading {

    // =========================================================
    // Data Structures & State Variables
    // =========================================================

    struct Prosumer {
        address prosumerAddress;
        int256  prosumerEnergyStat;
        uint256 prosumerBalance;
        bool    isMember;
    }

    mapping(address => Prosumer) public prosumers;

    uint256 private energyPrice;

    address private recorder;

    address[] private prosumerList;

    event CoordinationComplete(uint256 totalMatchedEnergy);

    // =========================================================
    // Constructor
    // =========================================================

    constructor(address _recorder) payable {
        require(_recorder != address(0), "Recorder address cannot be zero");
        recorder    = _recorder;
        energyPrice = 1 ether;
    }

    // =========================================================
    // Registration
    // =========================================================

    function registerProsumer() external {
        require(!prosumers[msg.sender].isMember, "Address is already registered as a prosumer");

        prosumers[msg.sender] = Prosumer({
            prosumerAddress    : msg.sender,
            prosumerEnergyStat : 0,
            prosumerBalance    : 0,
            isMember           : true
        });

        prosumerList.push(msg.sender);
    }

    // =========================================================
    // Deposit & Withdraw
    // =========================================================

    function deposit() external payable {
        require(prosumers[msg.sender].isMember, "Only registered prosumers can deposit");
        require(msg.value > 0, "Deposit amount must be greater than zero");

        prosumers[msg.sender].prosumerBalance += msg.value;
    }

    function withdraw(uint256 _value) external {
        require(prosumers[msg.sender].isMember, "Only registered prosumers can withdraw");
        require(prosumers[msg.sender].prosumerEnergyStat >= 0, "Cannot withdraw while holding an energy deficit");
        require(prosumers[msg.sender].prosumerBalance >= _value, "Insufficient contract balance");
        require(_value > 0, "Withdrawal amount must be greater than zero");

        prosumers[msg.sender].prosumerBalance -= _value;

        (bool success, ) = msg.sender.call{value: _value}("");
        require(success, "Ether transfer failed");
    }

    // =========================================================
    // Energy Status & Pricing
    // =========================================================

    function updateEnergyStatus(address _prosumer, int256 deltaEnergy) external {
        require(msg.sender == recorder, "Only the recorder can update energy status");
        require(prosumers[_prosumer].isMember, "Target address is not a registered prosumer");

        prosumers[_prosumer].prosumerEnergyStat += deltaEnergy;

        updateEnergyPrice();
    }

    function updateEnergyPrice() public {
        int256 totalEnergy = 0;

        for (uint256 i = 0; i < prosumerList.length; i++) {
            totalEnergy += prosumers[prosumerList[i]].prosumerEnergyStat;
        }

        uint256 base = 1 ether;
        uint256 step = 0.001 ether;
        uint256 maxP = 5 ether;
        uint256 minP = 0.1 ether;

        if (totalEnergy == 0) {
            energyPrice = base;
        } else if (totalEnergy < 0) {
            uint256 deficit  = uint256(-totalEnergy);
            uint256 newPrice = base + (deficit * step);
            energyPrice = newPrice > maxP ? maxP : newPrice;
        } else {
            uint256 surplus  = uint256(totalEnergy);
            uint256 decrease = surplus * step;
            if (decrease >= (base - minP)) {
                energyPrice = minP;
            } else {
                energyPrice = base - decrease;
            }
        }
    }

    // =========================================================
    // Manual P2P Trading
    // =========================================================

    function buyEnergyFrom(address _seller, uint _requestedEnergy) external {
        require(prosumers[msg.sender].isMember, "Buyer is not a registered prosumer");
        require(prosumers[_seller].isMember,    "Seller is not a registered prosumer");
        require(msg.sender != _seller,           "A prosumer cannot trade with itself");
        require(_requestedEnergy > 0,            "Requested energy must be a positive value");
        require(prosumers[msg.sender].prosumerEnergyStat < 0, "Buyer does not have an energy deficit");
        require(prosumers[_seller].prosumerEnergyStat    > 0, "Seller does not have an energy surplus");

        uint256 buyerDeficit  = uint256(-prosumers[msg.sender].prosumerEnergyStat);
        uint256 sellerSurplus = uint256( prosumers[_seller].prosumerEnergyStat);

        require(_requestedEnergy <= buyerDeficit,  "Cannot buy more energy than the recorded deficit");
        require(_requestedEnergy <= sellerSurplus, "Seller does not have sufficient surplus");

        uint256 totalCost = _requestedEnergy * energyPrice;
        require(prosumers[msg.sender].prosumerBalance >= totalCost, "Insufficient Ether balance to complete purchase");

        prosumers[msg.sender].prosumerBalance    -= totalCost;
        prosumers[_seller].prosumerBalance       += totalCost;
        prosumers[msg.sender].prosumerEnergyStat += int256(_requestedEnergy);
        prosumers[_seller].prosumerEnergyStat    -= int256(_requestedEnergy);

        updateEnergyPrice();
    }

    function sellEnergyTo(address _buyer, uint _offeredEnergy) external {
        require(prosumers[msg.sender].isMember, "Seller is not a registered prosumer");
        require(prosumers[_buyer].isMember,     "Buyer is not a registered prosumer");
        require(msg.sender != _buyer,            "A prosumer cannot trade with itself");
        require(_offeredEnergy > 0,              "Offered energy must be a positive value");
        require(prosumers[msg.sender].prosumerEnergyStat > 0, "Seller does not have an energy surplus");
        require(prosumers[_buyer].prosumerEnergyStat     < 0, "Buyer does not have an energy deficit");

        uint256 sellerSurplus = uint256( prosumers[msg.sender].prosumerEnergyStat);
        uint256 buyerDeficit  = uint256(-prosumers[_buyer].prosumerEnergyStat);

        require(_offeredEnergy <= sellerSurplus, "Cannot sell more energy than the recorded surplus");
        require(_offeredEnergy <= buyerDeficit,  "Buyer does not require that much energy");

        uint256 totalCost = _offeredEnergy * energyPrice;
        require(prosumers[_buyer].prosumerBalance >= totalCost, "Buyer has insufficient Ether balance");

        prosumers[_buyer].prosumerBalance        -= totalCost;
        prosumers[msg.sender].prosumerBalance    += totalCost;
        prosumers[msg.sender].prosumerEnergyStat -= int256(_offeredEnergy);
        prosumers[_buyer].prosumerEnergyStat     += int256(_offeredEnergy);

        updateEnergyPrice();
    }

    // =========================================================
    // Coordination Mechanism
    // =========================================================

    function coordinateTrading() public {
        uint256 sellerCount = 0;
        uint256 buyerCount  = 0;

        for (uint256 i = 0; i < prosumerList.length; i++) {
            int256 stat = prosumers[prosumerList[i]].prosumerEnergyStat;
            if      (stat > 0) sellerCount++;
            else if (stat < 0) buyerCount++;
        }

        if (sellerCount == 0 || buyerCount == 0) {
            emit CoordinationComplete(0);
            return;
        }

        address[] memory sellers = new address[](sellerCount);
        address[] memory buyers  = new address[](buyerCount);
        uint256 si = 0;
        uint256 bi = 0;

        for (uint256 i = 0; i < prosumerList.length; i++) {
            int256 stat = prosumers[prosumerList[i]].prosumerEnergyStat;
            if      (stat > 0) sellers[si++] = prosumerList[i];
            else if (stat < 0) buyers[bi++]  = prosumerList[i];
        }

        _sortSellersDesc(sellers);
        _sortBuyersDesc(buyers);

        uint256 totalMatched = 0;
        uint256 sIdx = 0;
        uint256 bIdx = 0;

        while (sIdx < sellers.length && bIdx < buyers.length) {
            address seller = sellers[sIdx];
            address buyer  = buyers[bIdx];

            uint256 surplus = uint256( prosumers[seller].prosumerEnergyStat);
            uint256 deficit = uint256(-prosumers[buyer].prosumerEnergyStat);

            if (surplus == 0) { sIdx++; continue; }
            if (deficit == 0) { bIdx++; continue; }

            uint256 tradeAmount = surplus < deficit ? surplus : deficit;
            uint256 cost        = tradeAmount * energyPrice;

            prosumers[buyer].prosumerBalance     -= cost;
            prosumers[seller].prosumerBalance    += cost;
            prosumers[seller].prosumerEnergyStat -= int256(tradeAmount);
            prosumers[buyer].prosumerEnergyStat  += int256(tradeAmount);

            totalMatched += tradeAmount;

            if (prosumers[seller].prosumerEnergyStat == 0) sIdx++;
            if (prosumers[buyer].prosumerEnergyStat  == 0) bIdx++;
        }

        updateEnergyPrice();
        emit CoordinationComplete(totalMatched);
    }

    // =========================================================
    // Internal Auxiliary Functions
    // =========================================================

    function _sortSellersDesc(address[] memory arr) internal view {
        uint256 n = arr.length;
        for (uint256 i = 1; i < n; i++) {
            address key    = arr[i];
            int256  keyVal = prosumers[key].prosumerEnergyStat;
            uint256 j      = i;
            while (j > 0 && prosumers[arr[j-1]].prosumerEnergyStat < keyVal) {
                arr[j] = arr[j-1];
                j--;
            }
            arr[j] = key;
        }
    }

    function _sortBuyersDesc(address[] memory arr) internal view {
        uint256 n = arr.length;
        for (uint256 i = 1; i < n; i++) {
            address key    = arr[i];
            int256  keyVal = prosumers[key].prosumerEnergyStat;
            uint256 j      = i;
            while (j > 0 && prosumers[arr[j-1]].prosumerEnergyStat > keyVal) {
                arr[j] = arr[j-1];
                j--;
            }
            arr[j] = key;
        }
    }

    // =========================================================
    // Public View Functions — DO NOT MODIFY
    // =========================================================

    function getRecorder() public view returns (address) {
        return recorder;
    }

    function getEnergyPrice() public view returns (uint256) {
        return energyPrice;
    }
}
