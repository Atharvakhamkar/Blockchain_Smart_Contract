const { expect } = require("chai");
const { ethers } = require("hardhat");

contractName = "EnergyTrading";

describe("EnergyTrading basic tests", function () {
    let EnergyTrading, contract, recorder, prosumer1, prosumer2, prosumer3;
    const totalProsumers = 3;

    beforeEach(async function () {
        [recorder, prosumer1, prosumer2, prosumer3] = await ethers.getSigners();
        EnergyTrading = await ethers.getContractFactory(contractName);
        contract = await EnergyTrading.deploy(recorder.address);
    });

    // =========================================================
    // BASIC TESTS (University Provided)
    // =========================================================

    it("Should deploy with correct recorder address", async function () {
        expect(await contract.getRecorder()).to.equal(recorder.address);
    });

    it("Should allow prosumers to register and have correct initial state", async function () {
        await contract.connect(prosumer1).registerProsumer();
        const prosumerData = await contract.prosumers(prosumer1.address);
        expect(prosumerData.prosumerEnergyStat).to.equal(0);
        expect(prosumerData.prosumerBalance).to.equal(0);
        expect(prosumerData.isMember).to.equal(true);
    });

    it("Should allow a registered prosumer to deposit Ethers", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("1") });
        const prosumerData = await contract.prosumers(prosumer1.address);
        expect(prosumerData.prosumerBalance).to.equal(ethers.parseEther("1"));
    });

    it("Should allow recorder to update energy status of prosumers", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, -1);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, 1);
        const prosumer1Data = await contract.prosumers(prosumer1.address);
        const prosumer2Data = await contract.prosumers(prosumer2.address);
        expect(prosumer1Data.prosumerEnergyStat).to.equal(-1);
        expect(prosumer2Data.prosumerEnergyStat).to.equal(1);
    });

    // =========================================================
    // REGISTRATION TESTS
    // =========================================================

    it("Should NOT allow the same address to register twice", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await expect(
            contract.connect(prosumer1).registerProsumer()
        ).to.be.revertedWith("Address is already registered as a prosumer");
    });

    it("Should allow multiple different prosumers to register", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();
        await contract.connect(prosumer3).registerProsumer();
        const p1 = await contract.prosumers(prosumer1.address);
        const p2 = await contract.prosumers(prosumer2.address);
        const p3 = await contract.prosumers(prosumer3.address);
        expect(p1.isMember).to.equal(true);
        expect(p2.isMember).to.equal(true);
        expect(p3.isMember).to.equal(true);
    });

    // =========================================================
    // DEPOSIT TESTS
    // =========================================================

    it("Should NOT allow unregistered address to deposit", async function () {
        await expect(
            contract.connect(prosumer1).deposit({ value: ethers.parseEther("1") })
        ).to.be.revertedWith("Only registered prosumers can deposit");
    });

    it("Should NOT allow deposit of zero Ether", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await expect(
            contract.connect(prosumer1).deposit({ value: 0 })
        ).to.be.revertedWith("Deposit amount must be greater than zero");
    });

    it("Should accumulate multiple deposits correctly", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("2") });
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("3") });
        const p = await contract.prosumers(prosumer1.address);
        expect(p.prosumerBalance).to.equal(ethers.parseEther("5"));
    });

    // =========================================================
    // WITHDRAW TESTS
    // =========================================================

    it("Should allow withdrawal when prosumer has no deficit", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("5") });
        await contract.connect(prosumer1).withdraw(ethers.parseEther("2"));
        const p = await contract.prosumers(prosumer1.address);
        expect(p.prosumerBalance).to.equal(ethers.parseEther("3"));
    });

    it("Should NOT allow withdrawal when prosumer has energy deficit", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("5") });
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, -3);
        await expect(
            contract.connect(prosumer1).withdraw(ethers.parseEther("1"))
        ).to.be.revertedWith("Cannot withdraw while holding an energy deficit");
    });

    it("Should NOT allow withdrawal exceeding balance", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("2") });
        await expect(
            contract.connect(prosumer1).withdraw(ethers.parseEther("5"))
        ).to.be.revertedWith("Insufficient contract balance");
    });

    it("Should NOT allow unregistered address to withdraw", async function () {
        await expect(
            contract.connect(prosumer1).withdraw(ethers.parseEther("1"))
        ).to.be.revertedWith("Only registered prosumers can withdraw");
    });

    // =========================================================
    // ENERGY STATUS TESTS
    // =========================================================

    it("Should NOT allow non-recorder to update energy status", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await expect(
            contract.connect(prosumer1).updateEnergyStatus(prosumer1.address, 5)
        ).to.be.revertedWith("Only the recorder can update energy status");
    });

    it("Should NOT allow recorder to update unregistered prosumer", async function () {
        await expect(
            contract.connect(recorder).updateEnergyStatus(prosumer1.address, 5)
        ).to.be.revertedWith("Target address is not a registered prosumer");
    });

    it("Should correctly accumulate multiple energy status updates", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 5);
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, -2);
        const p = await contract.prosumers(prosumer1.address);
        expect(p.prosumerEnergyStat).to.equal(3);
    });

    // =========================================================
    // ENERGY PRICE TESTS
    // =========================================================

    it("Should set energy price to 1 ether when community is balanced", async function () {
        expect(await contract.getEnergyPrice()).to.equal(ethers.parseEther("1"));
    });

    it("Should increase price when community has deficit", async function () {
        await contract.connect(prosumer1).registerProsumer();
        // deficit of 100 units -> price = 1 + (100 * 0.001) = 1.1 ether
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, -100);
        expect(await contract.getEnergyPrice()).to.equal(ethers.parseEther("1.1"));
    });

    it("Should decrease price when community has surplus", async function () {
        await contract.connect(prosumer1).registerProsumer();
        // surplus of 100 units -> price = 1 - (100 * 0.001) = 0.9 ether
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 100);
        expect(await contract.getEnergyPrice()).to.equal(ethers.parseEther("0.9"));
    });

    it("Should cap energy price at 5 ether", async function () {
        await contract.connect(prosumer1).registerProsumer();
        // deficit of 10000 units -> would be 11 ether but capped at 5
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, -10000);
        expect(await contract.getEnergyPrice()).to.equal(ethers.parseEther("5"));
    });

    it("Should floor energy price at 0.1 ether", async function () {
        await contract.connect(prosumer1).registerProsumer();
        // surplus of 10000 units -> would be negative but floored at 0.1
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10000);
        expect(await contract.getEnergyPrice()).to.equal(ethers.parseEther("0.1"));
    });

    // =========================================================
    // BUY ENERGY TESTS
    // =========================================================

    it("Should allow buyer to buy energy from seller", async function () {
        await contract.connect(prosumer1).registerProsumer(); // seller
        await contract.connect(prosumer2).registerProsumer(); // buyer

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await contract.connect(prosumer2).buyEnergyFrom(prosumer1.address, 5);

        const p1 = await contract.prosumers(prosumer1.address);
        const p2 = await contract.prosumers(prosumer2.address);
        expect(p1.prosumerEnergyStat).to.equal(5);
        expect(p2.prosumerEnergyStat).to.equal(0);
    });

    it("Should NOT allow buyer to buy more than their deficit", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -3);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await expect(
            contract.connect(prosumer2).buyEnergyFrom(prosumer1.address, 5)
        ).to.be.revertedWith("Cannot buy more energy than the recorded deficit");
    });

    it("Should NOT allow buyer to buy more than seller surplus", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 2);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await expect(
            contract.connect(prosumer2).buyEnergyFrom(prosumer1.address, 4)
        ).to.be.revertedWith("Seller does not have sufficient surplus");
    });

    it("Should NOT allow buy if buyer has insufficient Ether balance", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);
        // buyer has no balance

        await expect(
            contract.connect(prosumer2).buyEnergyFrom(prosumer1.address, 5)
        ).to.be.revertedWith("Insufficient Ether balance to complete purchase");
    });

    it("Should NOT allow unregistered prosumer to buy energy", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10);

        await expect(
            contract.connect(prosumer2).buyEnergyFrom(prosumer1.address, 5)
        ).to.be.revertedWith("Buyer is not a registered prosumer");
    });

    it("Should NOT allow prosumer to buy from itself", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, -5);
        await contract.connect(prosumer1).deposit({ value: ethers.parseEther("10") });

        await expect(
            contract.connect(prosumer1).buyEnergyFrom(prosumer1.address, 5)
        ).to.be.revertedWith("A prosumer cannot trade with itself");
    });

    // =========================================================
    // SELL ENERGY TESTS
    // =========================================================

    it("Should allow seller to sell energy to buyer", async function () {
        await contract.connect(prosumer1).registerProsumer(); // seller
        await contract.connect(prosumer2).registerProsumer(); // buyer

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await contract.connect(prosumer1).sellEnergyTo(prosumer2.address, 5);

        const p1 = await contract.prosumers(prosumer1.address);
        const p2 = await contract.prosumers(prosumer2.address);
        expect(p1.prosumerEnergyStat).to.equal(5);
        expect(p2.prosumerEnergyStat).to.equal(0);
    });

    it("Should NOT allow seller to sell more than their surplus", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 3);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -10);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await expect(
            contract.connect(prosumer1).sellEnergyTo(prosumer2.address, 5)
        ).to.be.revertedWith("Cannot sell more energy than the recorded surplus");
    });

    it("Should NOT allow seller to sell more than buyer needs", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 10);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -2);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await expect(
            contract.connect(prosumer1).sellEnergyTo(prosumer2.address, 5)
        ).to.be.revertedWith("Buyer does not require that much energy");
    });

    it("Should NOT allow unregistered prosumer to sell energy", async function () {
        await contract.connect(prosumer2).registerProsumer();
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);

        await expect(
            contract.connect(prosumer1).sellEnergyTo(prosumer2.address, 5)
        ).to.be.revertedWith("Seller is not a registered prosumer");
    });

    it("Should NOT allow prosumer to sell to itself", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 5);

        await expect(
            contract.connect(prosumer1).sellEnergyTo(prosumer1.address, 5)
        ).to.be.revertedWith("A prosumer cannot trade with itself");
    });

    // =========================================================
    // COORDINATE TRADING TESTS
    // =========================================================

    it("Should coordinate trading between multiple prosumers", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();
        await contract.connect(prosumer3).registerProsumer();

        // prosumer1 surplus 5, prosumer2 deficit 3, prosumer3 deficit 2
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 5);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -3);
        await contract.connect(recorder).updateEnergyStatus(prosumer3.address, -2);

        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });
        await contract.connect(prosumer3).deposit({ value: ethers.parseEther("10") });

        await contract.coordinateTrading();

        const p1 = await contract.prosumers(prosumer1.address);
        const p2 = await contract.prosumers(prosumer2.address);
        const p3 = await contract.prosumers(prosumer3.address);
        expect(p1.prosumerEnergyStat).to.equal(0);
        expect(p2.prosumerEnergyStat).to.equal(0);
        expect(p3.prosumerEnergyStat).to.equal(0);
    });

    it("Should emit CoordinationComplete event with correct total matched energy", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 5);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);
        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await expect(contract.coordinateTrading())
            .to.emit(contract, "CoordinationComplete")
            .withArgs(5);
    });

    it("Should emit CoordinationComplete with 0 when no trades possible", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        // Both have surplus - no buyers
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address, 5);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, 3);

        await expect(contract.coordinateTrading())
            .to.emit(contract, "CoordinationComplete")
            .withArgs(0);
    });

    it("Should prefer variance minimising outcome [-1,0,0,1,4] -> [0,0,0,1,3]", async function () {
        const signers = await ethers.getSigners();
        const [rec, p1, p2, p3, p4, p5] = signers;

        const freshContract = await (await ethers.getContractFactory(contractName)).deploy(rec.address);

        await freshContract.connect(p1).registerProsumer();
        await freshContract.connect(p2).registerProsumer();
        await freshContract.connect(p3).registerProsumer();
        await freshContract.connect(p4).registerProsumer();
        await freshContract.connect(p5).registerProsumer();

        // energy statuses: [-1, 0, 0, 1, 4]
        await freshContract.connect(rec).updateEnergyStatus(p1.address, -1);
        await freshContract.connect(rec).updateEnergyStatus(p4.address,  1);
        await freshContract.connect(rec).updateEnergyStatus(p5.address,  4);

        // p1 needs to buy, deposit enough ETH
        await freshContract.connect(p1).deposit({ value: ethers.parseEther("10") });

        await freshContract.coordinateTrading();

        const r1 = await freshContract.prosumers(p1.address);
        const r4 = await freshContract.prosumers(p4.address);
        const r5 = await freshContract.prosumers(p5.address);

        // Best variance result: p5 (largest seller) covers p1 (only buyer)
        // result should be [0, 0, 0, 1, 3] not [0, 0, 0, 0, 4]
        expect(r1.prosumerEnergyStat).to.equal(0);  // deficit cleared
        expect(r4.prosumerEnergyStat).to.equal(1);  // untouched (p5 matched first)
        expect(r5.prosumerEnergyStat).to.equal(3);  // reduced by 1
    });

    it("Should correctly transfer Ether balances during coordination", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();

        await contract.connect(recorder).updateEnergyStatus(prosumer1.address,  5);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);

        const price = await contract.getEnergyPrice();
        const expectedCost = BigInt(5) * price;

        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });

        await contract.coordinateTrading();

        const p1 = await contract.prosumers(prosumer1.address);
        const p2 = await contract.prosumers(prosumer2.address);

        expect(p1.prosumerBalance).to.equal(expectedCost);
        expect(p2.prosumerBalance).to.equal(ethers.parseEther("10") - expectedCost);
    });

    it("Should handle partial matching when surplus < total deficit", async function () {
        await contract.connect(prosumer1).registerProsumer();
        await contract.connect(prosumer2).registerProsumer();
        await contract.connect(prosumer3).registerProsumer();

        // seller has 3, buyers need 5 and 4 total = 9, only 3 can be matched
        await contract.connect(recorder).updateEnergyStatus(prosumer1.address,  3);
        await contract.connect(recorder).updateEnergyStatus(prosumer2.address, -5);
        await contract.connect(recorder).updateEnergyStatus(prosumer3.address, -4);

        await contract.connect(prosumer2).deposit({ value: ethers.parseEther("10") });
        await contract.connect(prosumer3).deposit({ value: ethers.parseEther("10") });

        await expect(contract.coordinateTrading())
            .to.emit(contract, "CoordinationComplete")
            .withArgs(3);

        const p1 = await contract.prosumers(prosumer1.address);
        expect(p1.prosumerEnergyStat).to.equal(0); // seller fully matched
    });
});
