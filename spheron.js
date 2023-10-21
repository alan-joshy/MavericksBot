// Step 0: Initial Setup and Dependencies
const { SpheronClient, ProtocolEnum } = require("@spheron/storage");
const { JsonRpcProvider, Wallet } = require("ethers");
const { Contract } = require("ethers");
const fs = require("fs");


// Connect to Spheron
const spheronToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlLZXkiOiJkNDA4MjI4YmI0ZDRkZmY4YWEwNTk4ZGQwNTc2ZWVlOTE3ODU0ZTFhNTQ1N2JhMWY3NjAwZTFlMTQ1MjIzZDc3Nzg5MDBhMThiYjBhYTJjYWQ4ZDAwOGNmNzgyOTllNWY1NmFlNjJiOGNkOGNjMTczZDZiM2QwYjkwYzVhMDZhMyIsImlhdCI6MTY5NzczOTAzOSwiaXNzIjoid3d3LnNwaGVyb24ubmV0d29yayJ9.dTUbjr9-aeiHirdPq-cDqfro8cEhCvsC_oUNZQKaSbg";
const client = new SpheronClient({ token: spheronToken });

// Connect to Avalanche C-Chain testnet
const provider = new JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");

const signer = new Wallet("583262788bd8da705ee55243e9c6202714de83c26c902f437715b43735ad31e9", provider);

// Your NFT smart contract address and ABI
const contractAddress = "0x95e29102c2E6C19a3368Bdb924EF8a22ccF4C95a";
const nftContractAbi = require("./abi.json");  // Replace with your NFT contract's ABI

const contract = new Contract(contractAddress, nftContractAbi, signer);

async function mintNFT(filePath, name) {
    // Step 1: Upload the asset to Spheron as a temporary file
    const tempImagePath = './temp_image.png';
    fs.copyFileSync(filePath, tempImagePath);  // Copy the original image to a temp file

    const { protocolLink: imageFolderLink } = await client.upload(tempImagePath, {
        protocol: ProtocolEnum.IPFS,
        name: name + "_image"
    });
    fs.unlinkSync(tempImagePath);  // Delete the temporary image file

    // Construct the direct image link
    const assetLink = `${imageFolderLink}/temp_image.png`;
    console.log(`Direct image link: ${assetLink}`);

    // Step 2: Create metadata JSON and upload to Spheron
    const metadata = {
        name: name,
        description: "Description of your NFT here",
        image: assetLink
    };
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    const tempMetadataPath = './temp_metadata.json';
    fs.writeFileSync(tempMetadataPath, metadataBuffer);

    const { protocolLink: metadataFolderLink } = await client.upload(tempMetadataPath, {
        protocol: ProtocolEnum.IPFS,
        name: name + "_metadata"
    });
    fs.unlinkSync(tempMetadataPath);  // Delete the temporary metadata file

    // Construct the direct metadata link
    const metadataLink = `${metadataFolderLink}/temp_metadata.json`;
    console.log(`Direct metadata link: ${metadataLink}`);

    // Step 3: Mint the NFT using the direct metadata link as the token's URI
    const tx = await contract.mint(metadataLink);
    const receipt = await tx.wait();

    console.log(`NFT minted! Transaction hash: ${receipt.transactionHash}`);
}



// Call the function
mintNFT("./avax.png", "NFT");
