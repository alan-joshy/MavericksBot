const { Bot } = require('grammy');
const sqlite3 = require('sqlite3').verbose();
const { Wallet } = require('ethers');

const bot = new Bot('6548464687:AAGgi0XSNOnNnIBjKE4pwRa4cvfPAyno_Ec');

const db = new sqlite3.Database('./users.db', (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        db.run("CREATE TABLE IF NOT EXISTS users (userId TEXT UNIQUE, walletAddress TEXT, privateKey TEXT, publicKey TEXT)", (err) => {
            if (err) {
                console.error('Error creating table:', err.message);
            }
        });
    }
});

function generateWallet() {
    const wallet = Wallet.createRandom();
    return {
        address: wallet.address,
        privateKey: wallet.privateKey,
        publicKey: wallet.publicKey,
        wallet: wallet.address,
    };
}

bot.command('start', async (ctx) => {
    const wallet = generateWallet();
    const userId = String(ctx.from.id);

    db.get("SELECT * FROM users WHERE userId = ?", [userId], async (err, row) => {
        if (err) {
            console.error('Error querying database:', err.message);
            ctx.reply('An error occurred. Please try again.');
            return;
        }

        if (row) {
            ctx.reply('You already have a wallet.');
        } else {
            db.run("INSERT INTO users (userId, walletAddress, privateKey, publicKey) VALUES (?, ?, ?, ?)", [userId, wallet.address, wallet.privateKey, wallet.publicKey], (err) => {
                if (err) {
                    console.error('Error inserting into database:', err.message);
                    ctx.reply('An error occurred. Please try again.');
                } else {
                    ctx.reply(`Wallet created successfully!
Address: ${wallet.address}
Private Key: ${wallet.privateKey}  ⚠️ (Keep this private and never share!)
Public Key: ${wallet.publicKey}`);
                }
            });
        }
    });
});

bot.start();
console.log('Bot is running...');
