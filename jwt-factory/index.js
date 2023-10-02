const express = require("express");
const jwt = require("jsonwebtoken");
const bodyParser = require("body-parser");
const { logger, expressWinstonLogger } = require("./logger");
const { createKeyPair, signingKeyPair, getKeyPair, storeKeyPair, loadKeysFromFiles, saveKeysToFiles } = require("./utils");

const app = express();
const port = process.env.PORT ?? 5555;

const ISSUER = process.env.ISSUER ?? "https://jwt-factory/";
const ALGORITHM = process.env.ALGORITHM ?? "RS256";

app.use(expressWinstonLogger);
app.use(bodyParser.json());

// Creates a new key pair for the specified keyId (e.g. servicea, serviceb)
// and returns a base64 encoded public key
app.post("/keys/:keyId", (req, res) => {
  const { keyId } = req.params;

  if (!keyId) {
    logger.warn("No keyId specified");
    return res.sendStatus(400);
  }

  const { publicKey, privateKey } = createKeyPair(keyId);
  // Store the key pair, so it can later be saved to disk with /dump
  storeKeyPair(keyId, { publicKey, privateKey });

  res.send({ publicKey: Buffer.from(publicKey).toString("base64") });
});

// Creates and signs a token with the specified keyId and provided claims (body)
// Optionally, you can use ?expires=1 to issue an expired token
app.post("/issueToken/:keyId", (req, res) => {
  const { keyId } = req.params;
  if (!keyId) {
    logger.warn("No keyId specified");
    return res.status(400).send("No keyId specified");
  }

  // Check if the ?expired=true query param is set and issue an expired token
  let defaultExpiration = Math.floor(Date.now() / 1000) + 60 * 60;
  if (req.query.expired) {
    logger.info("Issuing expired token");
    defaultExpiration = Math.floor(Date.now() / 1000) - 60 * 60;
  }

  const keyPair = getKeyPair(keyId);
  if (!keyPair) {
    logger.warn("Key not found");
    return res.status(404).send("Key not found");
  }

  // Read the claims from body
  const claims = req.body;

  // Output a warning if the claims are empty
  if (Object.keys(claims).length === 0) {
    logger.warn("No claims specified");
  }

  const { privateKey } = keyPair;
  const token = jwt.sign(
    {
      iss: ISSUER,
      sub: keyId,
      ...claims,
      exp: defaultExpiration,
    },
    privateKey,
    { algorithm: ALGORITHM }
  );

  const tokenString = token.toString();
  logger.info(`Issued token: ${tokenString}`);
  res.send(tokenString);
});

// Verifies token was signed with the specified keyId and checks the claims (audience, subject, issuer, algorithms)
app.post("/verify/:keyId", (req, res) => {
  const { keyId } = req.params;
  if (!keyId) {
    logger.warn("No keyId specified");
    return res.status(400).send("No keyId specified");
  }

  const keyPair = getKeyPair(keyId);

  if (!keyPair) {
    logger.warn("Key not found");
    return res.status(404).send({ valid: false, error: "key not found" });
  }

  const { publicKey } = keyPair;
  const { token, aud, sub } = req.body;

  if (!token) {
    logger.warn("No token specified");
    return res.status(400).send({ valid: false, error: "no token specified" });
  }

  if (!aud) {
    logger.warn("No audience specified");
    return res.status(400).send({ valid: false, error: "no audience specified" });
  }

  if (!sub) {
    logger.warn("No subject specified");
    return res.status(400).send({ valid: false, error: "no subject specified" });
  }

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
        logger.warn(`Invalid token (key ${keyId}): ${err}`);
        return res.status(403).send({ valid: false, error: err, claims: {} });
      }
      logger.info(`Valid token: token was signed with the specified keyId ${keyId}`);
      res.send({ valid: true, claims });
    }
  );
});

// Returns the public key for the specified keyId
app.get("/utils/publicKey/:keyId", (req, res) => {
  const { keyId } = req.params;

  // Check if the key exists
  const keyPair = getKeyPair(keyId);

  if (!keyPair) {
    logger.warn("Key not found");
    return res.sendStatus(404);
  }

  const { publicKey } = keyPair;
  res.send({ publicKey: Buffer.from(publicKey).toString("base64") });
});

// Returns all created (or loaded) keys in this instance 
app.get("/utils/keys", (req, res) => {
  res.json(Object.keys(signingKeyPair));
});

app.post("/utils/dump", (req, res) => {
  // Saves all keys into files
  saveKeysToFiles();
  res.sendStatus(200);
});

app.listen(port, () => {
  logger.info(`jwt-factory listening on port ${port}`);
  loadKeysFromFiles();
});

