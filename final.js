const { Bot } = require('grammy');
const sqlite3 = require('sqlite3').verbose();
const { ethers, Wallet, JsonRpcProvider, Contract } = require('ethers');
const fetch = require('node-fetch');
const fs = require('fs');
const { SpheronClient, ProtocolEnum } = require("@spheron/storage");

const bot = new Bot('6548464687:AAGgi0XSNOnNnIBjKE4pwRa4cvfPAyno_Ec');
const db = new sqlite3.Database('./users.db');

const provider = new JsonRpcProvider("https://api.avax-test.network/ext/bc/C/rpc");
const spheronToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhcGlLZXkiOiJkNDA4MjI4YmI0ZDRkZmY4YWEwNTk4ZGQwNTc2ZWVlOTE3ODU0ZTFhNTQ1N2JhMWY3NjAwZTFlMTQ1MjIzZDc3Nzg5MDBhMThiYjBhYTJjYWQ4ZDAwOGNmNzgyOTllNWY1NmFlNjJiOGNkOGNjMTczZDZiM2QwYjkwYzVhMDZhMyIsImlhdCI6MTY5NzczOTAzOSwiaXNzIjoid3d3LnNwaGVyb24ubmV0d29yayJ9.dTUbjr9-aeiHirdPq-cDqfro8cEhCvsC_oUNZQKaSbg";
const client = new SpheronClient({ token: spheronToken });
const contractAddress = "0xE5eedB3cCcA6a9012E9C18A4107b28F0A8065F19";
const nftContractAbi = require("./abi.json"); // Your NFT contract's ABI
const contractInterface = new ethers.Interface(nftContractAbi);

db.run("CREATE TABLE IF NOT EXISTS users (userId TEXT UNIQUE, walletAddress TEXT, privateKey TEXT, publicKey TEXT)");

function generateWallet() {
    const wallet = Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey
    };
}

bot.command('start', async (ctx) => {
    const wallet = generateWallet();
    const userId = String(ctx.from.id);
    db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) {
            ctx.reply('An error occurred. Please try again.');
            return;
        }
        if (row) {
            ctx.reply('You already have a wallet.');
        } else {
            db.run("INSERT INTO users (userId, walletAddress, privateKey, publicKey) VALUES (?, ?, ?, ?)", [userId, wallet.address, wallet.privateKey, wallet.publicKey], (err) => {
                if (err) {
                    ctx.reply('An error occurred. Please try again.');
                } else {
                    ctx.reply(`Wallet created successfully!\nAddress: ${wallet.address}\nPrivate Key: ${wallet.privateKey} ⚠️ (Keep this private and never share!)\nPublic Key: ${wallet.publicKey}`);
                }
            });
        }
    });
});
bot.command('wallet', (ctx) => {
    const userId = String(ctx.from.id);

    // Fetch user details from the database
    db.get("SELECT * FROM users WHERE userId = ?", [userId], (err, row) => {
        if (err) {
            ctx.reply('An error occurred. Please try again.');
            return;
        }

        if (row) {
            ctx.reply(`Your Wallet Address: ${row.walletAddress}`);
        } else {
            ctx.reply('You don\'t have a wallet. Please use /start to create one.');
        }
    });
});
let waitingForImage = {};

bot.command('mint', (ctx) => {
    const userId = String(ctx.from.id);
    waitingForImage[userId] = true;
    ctx.reply('Please send the image you want to mint as an NFT.');
});

async function getFileDetails(fileId) {
    const url = `https://api.telegram.org/bot6548464687:AAGgi0XSNOnNnIBjKE4pwRa4cvfPAyno_Ec/getFile?file_id=${fileId}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data && data.ok) {
        return data.result;
    } else {
        throw new Error(data.description || 'Failed to get file details from Telegram API.');
    }
}

bot.on('message', async (ctx) => {
    if (!ctx.message || !ctx.message.photo) return;

    const userId = String(ctx.from.id);
    if (!waitingForImage[userId]) return;

    waitingForImage[userId] = false;

    // Extract file ID from the photo message
    const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;

    if (!fileId) {
        console.error("File ID not found in the message.");
        ctx.reply("An error occurred. Please try again.");
        return;
    }

    try {
        // Get file details directly from the Bot API
        const botToken = '6548464687:AAGgi0XSNOnNnIBjKE4pwRa4cvfPAyno_Ec'; // Replace with your Telegram Bot Token
        const file = await getFileDetails(fileId, botToken);

        if (!file || !file.file_path) {
            console.error("Failed to retrieve file details from Telegram.");
            ctx.reply("An error occurred. Please try again.");
            return;
        }

        // Construct the file link
        const fileLink = `https://api.telegram.org/file/bot${botToken}/${file.file_path}`;

        const imageFilePath = `./${fileId}.png`;
        const response = await fetch(fileLink);
        const buffer = await response.buffer();
        fs.writeFileSync(imageFilePath, buffer);

        // Fetch user details and proceed with NFT minting
        db.get("SELECT * FROM users WHERE userId = ?", [userId], async (err, row) => {
            if (err) {
                ctx.reply('An error occurred. Please try again.');
                return;
            }

            if (!row) {
                ctx.reply('You don\'t have a wallet. Please use /start first.');
                return;
            }

            // Change the signer to the user's private key
            const userSigner = new Wallet(row.privateKey, provider);
            const recipientAddress = row.walletAddress;

            // Mint the NFT
            try {
                await mintNFT(imageFilePath, "User's NFT", userSigner, ctx); // Pass ctx here
            } catch (err) {
                console.error('Error minting NFT:', err);
                ctx.reply('An error occurred while minting the NFT. Please try again later.');
            }

            // Delete the downloaded image file
            fs.unlinkSync(imageFilePath);
        });

    } catch (err) {
        console.error("Error processing the image:", err);
        ctx.reply("An error occurred. Please try again.");
    }
});

async function mintNFT(filePath, name, userSigner, ctx) { // Added ctx here
    // Validate that recipientAddress is a valid Ethereum address

    // Copy the file to a temporary location
    const tempImagePath = './temp_image.png';
    fs.copyFileSync(filePath, tempImagePath);

    // Upload the image to IPFS
    const { protocolLink: imageFolderLink } = await client.upload(tempImagePath, {
        protocol: ProtocolEnum.IPFS,
        name: name + "_image"
    });
    fs.unlinkSync(tempImagePath);

    // Construct the asset link
    const assetLink = `${imageFolderLink}/temp_image.png`;

    // Create the metadata for the NFT
    const metadata = {
        name: name,
        description: "Description of your NFT",
        image: assetLink
    };
    const metadataBuffer = Buffer.from(JSON.stringify(metadata));
    const tempMetadataPath = './temp_metadata.json';
    fs.writeFileSync(tempMetadataPath, metadataBuffer);

    // Upload the metadata to IPFS
    const { protocolLink: metadataFolderLink } = await client.upload(tempMetadataPath, {
        protocol: ProtocolEnum.IPFS,
        name: name + "_metadata"
    });
    fs.unlinkSync(tempMetadataPath);

    // Construct the metadata link
    const metadataLink = `${metadataFolderLink}/temp_metadata.json`;

    // Create a new Contract instance using the user's signer
    const userContract = new Contract(contractAddress, nftContractAbi, userSigner);

    // Mint the NFT
    const tx = await userContract.mint(userSigner.address, metadataLink);
    const txhash = tx.hash;

    // Wait for the transaction to be mined
    const receipt = await tx.wait();
    

    // Fetch the logs from the receipt
    const logs = receipt.logs;

    // Parse the logs using the contract's interface
    const parsedLogs = logs
        .filter(log => log.address.toLowerCase() === contractAddress.toLowerCase())
        .map(log => {
            try {
                return contractInterface.parseLog(log);
            } catch (error) {
                // If there's an error, it might mean this log is not part of the contract events we have the ABI for.
                return null;
            }
        })
        .filter(event => event !== null);  // Remove logs that couldn't be parsed
    // Extracting the NewMint event details
const newMintEvent = parsedLogs.find(event => event.name === 'NewMint');

if (newMintEvent) {
    const tokenId = newMintEvent.args[1].toString(); // Convert the BigInt (24n) to a string
    const ownerAddress = newMintEvent.args[0];

    // Send the success message to the chat
    ctx.reply(`NFT Minted Successfully!\nTX Hash: ${txhash}\nToken ID: ${tokenId}\nOwner Address: ${ownerAddress}`);
} else {
    ctx.reply('An error occurred. Could not find the NewMint event in the transaction logs.');
}

    console.log(parsedLogs); // This will print the parsed logs (events) to the console
}


bot.start();
console.log('Bot is running...');
