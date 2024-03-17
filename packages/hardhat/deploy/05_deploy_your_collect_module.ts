import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";
import { YourCollectModule } from "../typechain-types";
import { ethers } from "hardhat";
import { module } from "@lens-protocol/metadata";
import { uploadMetadata } from "../lib/irys-service";

/**
 * Generates the metadata for the YourCollectModule contract compliant with the Module Metadata Standard at:
 * https://docs.lens.xyz/docs/module-metadata-standard
 */
const metadata = module({
  name: "YourCollectModule",
  title: "Your Collect Action",
  description: "Description of your collect action",
  authors: ["some@email.com"],
  initializeCalldataABI: JSON.stringify([]),
  processCalldataABI: JSON.stringify([]),
  attributes: [],
});

/**
 * Deploys a contract named "YourCollectModule" using the deployer account and
 * constructor arguments set to the deployer address
 *
 * @param hre HardhatRuntimeEnvironment object.
 */
const deployYourCollectModuleContract: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  /*
    On localhost, the deployer account is the one that comes with Hardhat, which is already funded.

    When deploying to live networks (e.g `yarn deploy --network goerli`), the deployer account
    should have sufficient balance to pay for the gas fees for contract creation.

    You can generate a random account with `yarn generate` which will fill DEPLOYER_PRIVATE_KEY
    with a random private key in the .env file (then used on hardhat.config.ts)
    You can run the `yarn account` command to check your balance in every network.
  */
  const { deployer } = await hre.getNamedAccounts();
  const { deploy, get } = hre.deployments;

  // This is the address of the LensHub contract on the network we're deploying to
  // When running locally, this should be the address of burner wallet used in the nextjs app
  const lensHubAddress = process.env.LENS_HUB;

  // First check to see if there's a local mocked ModuleRegistry contract deployed
  // This allows us to run tests locally with the same flow as on-chain
  let moduleRegistry: string | undefined;
  try {
    const { address } = await get("ModuleRegistry");
    moduleRegistry = address;
  } catch (e) {}

  // If there's no local mocked ModuleRegistry, use the live address from the environment
  if (!moduleRegistry) {
    moduleRegistry = process.env.MODULE_REGISTRY;
  }

  // Next, check to see if there's a local mocked CollectNFT contract deployed
  // This allows us to run tests locally with the same flow as on-chain
  let collectNFT: string | undefined;
  try {
    const { address } = await get("CollectNFT");
    collectNFT = address;
  } catch (e) {}

  // If there's no local mocked CollectNFT, use the live address from the environment
  if (!collectNFT) {
    collectNFT = process.env.COLLECT_NFT;
  }

  // Next, check to see if there's a local mocked CollectPublicationAction contract deployed
  // This allows us to run tests locally with the same flow as on-chain
  let collectPublicationAction: string | undefined;
  try {
    const { address } = await get("CollectPublicationAction");
    collectPublicationAction = address;
  } catch (e) {}

  // If there's no local mocked CollectPublicationAction, use the live address from the environment
  if (!collectPublicationAction) {
    collectPublicationAction = process.env.COLLECT_PUBLICATION_ACTION;
  }

  // Deploy the YourCollectModule contract
  await deploy("YourCollectModule", {
    from: deployer,
    args: [lensHubAddress, collectPublicationAction, moduleRegistry, deployer],
    log: true,
    // autoMine: can be passed to the deploy function to make the deployment process faster on local networks by
    // automatically mining the contract deployment transaction. There is no effect on live networks.
    autoMine: true,
  });

  // Get the deployed contract
  const yourCollectModule = await hre.ethers.getContract<YourCollectModule>("YourCollectModule", deployer);

  // Upload the metadata to Arweave with Irys and set the URI on the contract
  const metadataURI = await uploadMetadata(metadata);
  await yourCollectModule.setModuleMetadataURI(metadataURI);

  // Add a delay before calling registerModule to allow for propagation
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Register the module with the Publication Action
  const publicationActionContract = await ethers.getContractAt("CollectPublicationAction", collectPublicationAction!);
  await publicationActionContract.registerCollectModule(await yourCollectModule.getAddress());
  console.log("Registered YourCollectModule with CollectPublicationAction");
};

export default deployYourCollectModuleContract;

// Tags are useful if you have multiple deploy files and only want to run one of them.
// e.g. yarn deploy --tags YourCollectModule
deployYourCollectModuleContract.tags = ["YourCollectModule"];
