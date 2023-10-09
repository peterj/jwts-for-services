const { generateKeyPairSync } = require("crypto");
const fs = require("fs");
const jwt = require("jsonwebtoken");

const { logger } = require("./logger");
const { log } = require("console");

const ISSUER = process.env.ISSUER ?? "https://service-issuer";
const ALGORITHM = process.env.ALGORITHM ?? "RS256";

// Returns a string token
function getTokenFromJWTFactory(claims, expired) {
  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(claims),
  };

  let url = `${process.env.JWT_FACTORY_ENDPOINT}/issueToken/${process.env.SERVICE_NAME}`;
  if (expired) {
    url = `${process.env.JWT_FACTORY_ENDPOINT}/issueToken/${process.env.SERVICE_NAME}?expired=true`;
  }

  logger.info(`Getting token from JWT factory at ${url} (expired: ${expired})`);

  return fetch(url, options)
    .then((res) => res.text())
    .then(
      (token) => {
        return token;
      },
      (err) => {
        logger.error(err);
        throw err;
      }
    );
}

function getTokenFromHeader(req) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  return token;
}

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

function saveKeysToFiles(keyPair, prefix) {
  // Get the current folder
  const currentFolder = process.cwd();

  // Create the keys folder
  const keysFolder = `${currentFolder}/scenario-3-keys`;
  if (!fs.existsSync(keysFolder)) {
    fs.mkdirSync(keysFolder);
  }

  const { publicKey, privateKey } = keyPair;

  // Save the keys to files
  fs.writeFileSync(`${keysFolder}/${prefix}-public.pem`, publicKey);
  fs.writeFileSync(`${keysFolder}/${prefix}-private.pem`, privateKey);

  // Return the folder where the keys were saved
  return keysFolder;
}

function createJwt(privateKey, claims, expired) {
  // 1 second expiration
  let defaultExpiration = Math.floor(Date.now() / 1000) + 1;
  if (expired) {
    logger.info("Issuing expired token");
    defaultExpiration = Math.floor(Date.now() / 1000) - 60 * 60;
  }

  // Output a warning if the claims are empty
  if (Object.keys(claims).length === 0) {
    logger.warn("No claims specified");
  }

  const token = jwt.sign(
    {
      iss: ISSUER,
      ...claims,
      exp: defaultExpiration,
    },
    privateKey,
    { algorithm: ALGORITHM }
  );
  return token.toString();
}

async function verifyJwt(publicKey, token, claims) {
  if (!token) {
    logger.warn("No token specified");
    return { valid: false, error: "no token specified" };
  }

  const { aud, sub } = claims;

  if (!aud) {
    logger.warn("No audience specified");
    return { valid: false, error: "no audience specified" };
  }

  if (!sub) {
    logger.warn("No subject specified");
    return { valid: false, error: "no subject specified" };
  }

  logger.debug(`Verifying token: ${token}`);
  logger.debug(`aud: ${aud}`);
  logger.debug(`sub: ${sub}`);
  logger.debug(publicKey);

  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      publicKey,
      {
        issuer: ISSUER,
        algorithms: [ALGORITHM],
        audience: aud,
        subject: sub,
      },
      (err, claims) => {
        if (err) {
          logger.warn(`Invalid token: ${err}`);
          resolve({ valid: false, error: err, claims: {} });
        } else {
          logger.info(`Valid token: token was signed with the correct key and audience and subject claims are valid`);
          resolve({ valid: true, claims });
        }
      }
    );
  });
}

module.exports = {
  getTokenFromJWTFactory,
  getTokenFromHeader,
  createKeyPair,
  saveKeysToFiles,
  createJwt,
  verifyJwt,
};
