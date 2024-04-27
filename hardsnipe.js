const { ethers } = require("ethers");
const Web3 = require("web3");
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const TOKEN_ABI = require("./tokenabi.json");

console.log("Initializing bot...");

const provider2 = new ethers.providers.JsonRpcProvider(
  "https://eth-mainnet.g.alchemy.com/v2/_F7q6-ilaTTXVSfxh5jXbN2Rqs4_004y"
);
const etherscanApiKey = "SCTNEKJG2SDUQ8SAK4NKFA2QVTM8Z3W46J";

const bot = new TelegramBot("6497048324:AAGN0Mm_mjFYPlYgv-ignG8y4EIjsYXnPIY", {
  polling: false,
});

async function extractSocialLinks(contractAddress) {
  try {
    console.log("Extracting social links for address:", contractAddress);

    const etherscanUrl = `https://api.etherscan.io/api?module=contract&action=getsourcecode&address=${contractAddress}&apikey=${etherscanApiKey}`;
    const etherscanResponse = await axios.get(etherscanUrl);
    const sourceCode = etherscanResponse?.data?.result?.[0]?.SourceCode || "";
    const links = [];

    if (sourceCode) {
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const matchedLinks = sourceCode.match(urlRegex);

      if (matchedLinks) {
        for (const link of matchedLinks) {
          let cleanLink = link.split(" ")[0];
          cleanLink = cleanLink.replace(/[\r\n]+/g, "");
          cleanLink = cleanLink.split("\\n")[0];
          cleanLink = cleanLink.split("%5Cr")[0];
          console.log("Processing link:", cleanLink);
          if (
            cleanLink.startsWith("https://github.com") ||
            cleanLink.startsWith("https://hardhat.org") ||
            cleanLink.startsWith("https://forum.openzeppelin.com") ||
            cleanLink.startsWith("https://web3js.readthedocs.io") ||
            cleanLink.startsWith("https://eips.ethereum.org") ||
            cleanLink.startsWith("https://docs.metamask.io") ||
            cleanLink.startsWith("https://eth.wiki") ||
            cleanLink.startsWith("https://docs.ethers.io") ||
            cleanLink.startsWith("https://forum.zeppelin.solutions") ||
            cleanLink.startsWith("https://raw.githubusercontent.com") ||
            cleanLink.startsWith("https://diligence.consensys.net") ||
            cleanLink.startsWith("https://solidity.readthedocs.io") ||
            cleanLink.startsWith("https://etherscan.io") ||
            cleanLink.startsWith("https://en.wikipedia.org")
          ) {
            continue;
          }
          if (cleanLink.startsWith("https://t.me")) {
            links.push(`<a href="${cleanLink}">Telegram |</a>`);
          } else if (cleanLink.startsWith("https://twitter.com")) {
            links.push(`<a href="${cleanLink}">Twitter |</a>`);
          } else if (cleanLink.startsWith("https://docs")) {
            links.push(`<a href="${cleanLink}">Docs |</a>`);
          } else if (cleanLink.startsWith("https://discord.gg")) {
            links.push(`<a href="${cleanLink}">Discord |</a>`);
          } else if (
            cleanLink.startsWith("https://") ||
            cleanLink.startsWith("http://")
          ) {
            links.push(`<a href="${cleanLink}">Website |</a>`);
          }
        }
        console.log("Final Links Array:", links);
      } else {
        console.log("No links found in the source code.");
      }
    } else {
      console.log("No source code available for address:", contractAddress);
    }

    return links.length > 0 ? links.join(" ") : "No link available";
  } catch (error) {
    console.error("Error in extractSocialLinks:", error);
    return "No link available";
  }
}

async function getTokenDetails(tokenAddress) {
  try {
    const response = await axios.get(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`
    );
    const data = response.data;

    if (data && data.pairs && data.pairs.length > 0) {
      const tokenDetails = data.pairs[0];
      return tokenDetails;
    } else {
      console.warn(
        `No data received from dexscreener for token ${tokenAddress}`
      );
      return null;
    }
  } catch (error) {
    console.error(`Error fetching token details for ${tokenAddress}:`, error);
    return null;
  }
}

let reportedTokens = new Set();

async function sendTelegramMessage(
  tokenAddress,
  numberOfTransactions,
  transactionType
) {
  try {
    const tokenDetails = await getTokenDetails(tokenAddress);
    const volume24h =
      tokenDetails && tokenDetails.volume && tokenDetails.volume.h24
        ? tokenDetails.volume.h24
        : "Unknown";
    const mcap =
      tokenDetails && tokenDetails.fdv && tokenDetails.fdv
        ? tokenDetails.fdv
        : "Unknown";
    const liquidity =
      tokenDetails && tokenDetails.liquidity && tokenDetails.liquidity.usd
        ? tokenDetails.liquidity.usd
        : "Unknown";

    const contractInstance = new ethers.Contract(
      tokenAddress,
      TOKEN_ABI,
      provider2
    );
    const tokenName = await contractInstance.name();
    const tokenSymbol = await contractInstance.symbol();
    const totalSupply = await contractInstance.totalSupply();
    const decimals = await contractInstance.decimals();
    const adjustedTotalSupply = parseInt(
      ethers.utils.formatUnits(totalSupply, decimals)
    );

    const socialLinks = await extractSocialLinks(tokenAddress);

    const message = `🎯 <b>${transactionType} Alert</b>\n\n🪙 ${tokenName} <a href="https://etherscan.io/token/${tokenAddress}">${tokenSymbol}</a>\n💰Total Supply: <code>${adjustedTotalSupply} (${decimals} decimals)</code>\n\n🫧 Socials: ${socialLinks}\n\n🌀 ${transactionType} <b>${numberOfTransactions}</b> times in less than 20 secs\n📈 Volume: $${volume24h}\n💰 Mcap: $${mcap}\n💧 Liquidity: $${parseFloat(
      liquidity
    ).toLocaleString("en-US", {
      maximumFractionDigits: 0,
    })}\n\nCA: <code>${tokenAddress}</code>`;
    const opts = {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "Dexscreener",
              url: `https://dexscreener.com/ethereum/${tokenAddress}`,
            },
            {
              text: "Dextools",
              url: `https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}`,
            },
          ],
        ],
      }),
    };

    bot.sendMessage("@hardsnipechecker", message, opts);
    console.log(
      `Reporting ${transactionType.toLowerCase()} for: ${tokenAddress}`
    );

    reportedTokens.add(tokenAddress);
  } catch (error) {
    console.error(
      `Error in sendTelegramMessage for ${transactionType}:`,
      error
    );
  }
}

const ALERT_THRESHOLD = 25;
const ALERT_INTERVAL = 20000; // 20 seconds

let transactionTimestamps = {};

function addTransaction(tokenAddress) {
  const now = Date.now();

  if (!transactionTimestamps[tokenAddress]) {
    transactionTimestamps[tokenAddress] = {
      startTime: now,
      timestamps: [],
    };
  }

  transactionTimestamps[tokenAddress].timestamps.push(now);
}

function sendAlert(tokenAddress) {
  if (
    !transactionTimestamps[tokenAddress] ||
    transactionTimestamps[tokenAddress].timestamps.length < ALERT_THRESHOLD
  ) {
    return;
  }

  // Check if the token has already been reported
  if (reportedTokens.has(tokenAddress)) {
    console.log(`Token ${tokenAddress} has already been reported. Skipping...`);
    return;
  }

  const finalCount = transactionTimestamps[tokenAddress].timestamps.length;
  sendTelegramMessage(tokenAddress, finalCount, "Hard Sniped");
  delete transactionTimestamps[tokenAddress];
}

const RECONNECT_INTERVAL = 5000;

const websocketURL =
  "wss://eth-mainnet.g.alchemy.com/v2/_F7q6-ilaTTXVSfxh5jXbN2Rqs4_004y";

let web3;

async function resetWeb3Connection() {
  if (web3 && web3.currentProvider && web3.currentProvider.connection) {
    web3.currentProvider.connection.close();
  }
  web3 = null;
  initializeWeb3();
}

function initializeWeb3() {
  const provider = new Web3.providers.WebsocketProvider(websocketURL);
  web3 = new Web3(provider);

  provider.on("end", async () => {
    console.log("WS connection closed. Attempting to reconnect...");
    await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
    await resetWeb3Connection();
  });

  provider.on("error", async (err) => {
    console.error("WS connection error:", err);
    await resetWeb3Connection();
  });
}

function cleanupTransactions() {
  const now = Date.now();
  const tokensToRemove = [];

  for (const tokenAddress in transactionTimestamps) {
    const elapsed = now - transactionTimestamps[tokenAddress].startTime;

    if (elapsed > ALERT_INTERVAL) {
      if (
        transactionTimestamps[tokenAddress].timestamps.length >= ALERT_THRESHOLD
      ) {
        sendAlert(tokenAddress);
      }
      tokensToRemove.push(tokenAddress);
    }
  }

  for (const token of tokensToRemove) {
    delete transactionTimestamps[token];
  }
}

async function processTransaction(tx) {
  try {
    const inputData = tx.input;
    const methodId = inputData.slice(0, 10);
    let tokenAddress;

    const METHOD_ID_MAP = {
      "0x7ff36ab5": 6,
      "0xb6f9de95": 6,
      "0x38ed1739": 7,
    };

    const UNISWAP_ROUTER_ADDRESS = "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D"; // Uniswap Router
    const BANANA_ROUTER_ADDRESS = "0x3328F7f4A1D1C57c35df56bBf0c9dCAFCA309C49"; // Banana Router
    const MAESTRO_ROUTER_ADDRESS = "0x4B8c0A0df725750aeb948816B4dffeCD32ee9008"; // Maestro Router

    if (tx.to === BANANA_ROUTER_ADDRESS && methodId === "0x0162e2d0") {
      console.log("Matching Banana Router Method ID, proceeding...");
      const params = inputData.slice(10);
      const fullDataElement = params.slice(13 * 64, 13 * 64 + 64);
      tokenAddress = "0x" + fullDataElement.slice(24, 64);
      console.log(`Extracted Token Address for Banana Router: ${tokenAddress}`);
    } else if (tx.to === UNISWAP_ROUTER_ADDRESS && METHOD_ID_MAP[methodId]) {
      console.log("Matching Uniswap Router Method ID, proceeding...");
      tokenAddress = "0x" + inputData.slice(-40);
      console.log(
        `Extracted Token Address for Uniswap Router: ${tokenAddress}`
      );
    } else if (tx.to === MAESTRO_ROUTER_ADDRESS && methodId === "0xa0136443") {
      console.log("Matching MAESTRO Router Method ID, proceeding...");
      tokenAddress = "0x" + inputData.slice(-40);
      console.log(`Extracted Token Address for MESTRO Router: ${tokenAddress}`);
    }

    if (tokenAddress) {
      addTransaction(tokenAddress);
    }
  } catch (err) {
    console.error(
      `Error processing transaction data for ${tx.hash} - ${err.message}`
    );
  }
}

async function monitorBlocks() {
  let subscription;
  let isSubscribed = false;

  function isConnected() {
    return web3 && web3.currentProvider && web3.currentProvider.connected;
  }

  while (true) {
    try {
      if (!isSubscribed) {
        if (subscription) {
          subscription.unsubscribe();
          await new Promise((resolve) =>
            setTimeout(resolve, RECONNECT_INTERVAL)
          );
        }

        subscription = await web3.eth.subscribe("newBlockHeaders");

        subscription.on("data", async (blockHeader) => {
          try {
            if (!isConnected()) {
              console.error("WebSocket connection is not open.");
              throw new Error("WebSocket connection lost");
            }

            const block = await web3.eth.getBlock(blockHeader.hash, false);
            if (block && block.transactions) {
              for (const txHash of block.transactions) {
                try {
                  const tx = await web3.eth.getTransaction(txHash);
                  await processTransaction(tx);
                } catch (err) {
                  if (err.message.includes("Frame size of")) {
                    console.warn(
                      "Frame size error, skipping this transaction:",
                      txHash
                    );
                  } else {
                    console.error(
                      `Error processing transaction ${txHash} - ${err.message}`
                    );
                  }
                }
              }
            }
          } catch (err) {
            console.error("Error processing the block:", err);
            if (err.message.includes("WebSocket connection lost")) {
              isSubscribed = false;
              throw err;
            }
          }
        });

        subscription.on("error", (error) => {
          console.error("Subscription error:", error);
          isSubscribed = false;
        });

        console.log("Successfully started monitoring blocks.");
        isSubscribed = true;
      }

      await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
    } catch (e) {
      console.error(
        "Error occurred while attempting to connect or subscribe:",
        e
      );
      isSubscribed = false;
      await resetWeb3Connection();
      await new Promise((resolve) => setTimeout(resolve, RECONNECT_INTERVAL));
    }
  }
}

initializeWeb3();
setInterval(cleanupTransactions, ALERT_INTERVAL);

monitorBlocks().catch((err) => {
  console.error("Fatal error occurred:", err);
});
