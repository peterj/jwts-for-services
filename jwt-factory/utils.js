const { generateKeyPairSync } = require("crypto");
const fs = require("fs");
const { logger } = require("./logger");

const KEYS_FOLDER = "./keys";
let signingKeyPair = {};

function createKeyPair() {
  logger.info("Generating new key pair");
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs1",
      format: "pem",
    },
  });

  const obj = {
    publicKey,
    privateKey,
  };

  return obj;
}

function storeKeyPair(keyId, keyPair) {
  logger.info(`Storing key pair for keyId: ${keyId}`);
  signingKeyPair[keyId] = keyPair;
}

function getKeyPair(keyId) {
  logger.info(`Getting key pair for keyId: ${keyId}`);
  return signingKeyPair[keyId];
}

function loadKeysFromFiles() {
  ensureFolder(KEYS_FOLDER);
  // Load any keys from the keys directory
  const keyFiles = fs.readdirSync(KEYS_FOLDER);

  keyFiles.forEach((keyFile) => {
    const keySplit = keyFile.split("-");

    const keyId = keySplit[0];
    const keyType = keySplit[1].split(".")[0];

    logger.info(`Loading key: ${keyId} (${keyType})`);
    const key = fs.readFileSync(`${KEYS_FOLDER}/${keyFile}`);

    if (keyType === "public") {
      signingKeyPair[keyId] = {
        ...signingKeyPair[keyId],
        publicKey: key,
      };
    } else if (keyType === "private") {
      signingKeyPair[keyId] = {
        ...signingKeyPair[keyId],
        privateKey: key,
      };
    }
  });
}

function saveKeysToFiles() {
  ensureFolder(KEYS_FOLDER);
  // Saves all keys into files
  Object.keys(signingKeyPair).forEach((keyId) => {
    logger.info(`Saving key pair for keyId: ${keyId}`);
    const keyPair = signingKeyPair[keyId];
    const { publicKey, privateKey } = keyPair;

    // Save the keys to files
    fs.writeFileSync(`./keys/${keyId}-public.pem`, publicKey);
    fs.writeFileSync(`./keys/${keyId}-private.pem`, privateKey);
  });
}


function ensureFolder(path) {
  if (!fs.existsSync(path)) {
    fs.mkdirSync(path);
  }
}

module.exports = {
  createKeyPair,
  signingKeyPair,
  storeKeyPair,
  getKeyPair,

  loadKeysFromFiles,
  saveKeysToFiles,
  ensureFolder
};
