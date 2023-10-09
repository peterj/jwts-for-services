const express = require("express");
const fs = require("fs");
const http = require("http");
const https = require("https");

const { logger, expressWinstonLogger } = require("./logger");
const { getTokenFromJWTFactory, getTokenFromHeader, createKeyPair, saveKeysToFiles, createJwt, verifyJwt } = require("./utils");

const port = process.env.PORT ?? 3000;
const SERVICE_NAME = process.env.SERVICE_NAME;

const app = express();

const httpServer = http.createServer(app);
httpServer.listen(port);
logger.info(`http ${SERVICE_NAME} listening on port ${port}`);

if (process.env.START_HTTPS === "1") {
  const serverPublicKey = fs.readFileSync(process.env.SERVER_PUBLIC_KEY_PATH);
  const serverPrivateKey = fs.readFileSync(process.env.SERVER_PRIVATE_KEY_PATH);

  const httpsServer = https.createServer(
    {
      key: serverPrivateKey,
      cert: serverPublicKey,
    },
    app
  );

  httpsServer.listen(process.env.HTTPS_PORT);
  logger.info(`https ${SERVICE_NAME} listening on port ${process.env.HTTPS_PORT}`);
}

app.use(expressWinstonLogger);

// Steps:
// 1. Service requests a token from the JWT factory, so it can call serviceb
// 2. Service calls serviceb with the token
// 3. Serviceb verifies the token and returns the claims (or an error)
app.get("/scenario1", async (req, res) => {
  const expiredToken = Boolean(req.query.expired);
  const token = await getTokenFromJWTFactory(
    {
      sub: SERVICE_NAME,
      aud: "serviceb",
    },
    expiredToken
  );

  logger.info(`Got token from JWT factory: ${token}`);

  // Call serviceb with the token
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  };

  const url = `${process.env.SERVICE_B_ENDPOINT}/scenario1-server`;
  logger.info(`Calling serviceb at ${url}`);
  const result = await fetch(url, options);
  const claims = await result.json();
  res.json(claims);
});

// This is the endpoint that gets called by /scenario1
app.get("/scenario1-server", async (req, res) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    logger.info("No token provided");
    return res.status(401).json({ message: "no token provided" });
  }

  logger.info(`Verifying token by making a call to ${process.env.JWT_FACTORY_ENDPOINT}`);

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, aud: SERVICE_NAME, sub: "servicea" }),
  };

  // We're verifying token is signed by servicea key and it has the correct audience and subject claims
  const url = `${process.env.JWT_FACTORY_ENDPOINT}/verify/servicea`;

  const verifyResult = await fetch(url, options);
  const verifyResultJson = await verifyResult.json();

  if (!verifyResultJson.valid) {
    logger.info("Invalid token");
    return res.status(403).json({ message: `invalid token`, ...verifyResultJson });
  }

  logger.info("Valid token");
  res.send(verifyResultJson);
});

// Service A obtains a token from the JWT factory for calling service B and for calling service C,
// then proceeds to call both services and returns the aggregated results
app.get("/scenario2", async (req, res) => {
  const expiredToken = Boolean(req.query.expired);

  const tokenForB = await getTokenFromJWTFactory({
    sub: SERVICE_NAME,
    aud: "serviceb",
  });
  logger.info(`Got token from JWT factory for calling service B: ${tokenForB}`);

  const tokenForC = await getTokenFromJWTFactory(
    {
      sub: SERVICE_NAME,
      aud: "servicec",
    },
    expiredToken
  );
  logger.info(`Got token from JWT factory for calling service C: ${tokenForC}`);

  // Call service B
  const urlB = `${process.env.SERVICE_B_ENDPOINT}/scenario2-server`;
  logger.info(`Calling service B at ${urlB}`);
  const servicebResponse = await fetch(urlB, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenForB}`,
    },
  });

  // Call service C
  const urlC = `${process.env.SERVICE_C_ENDPOINT}/scenario2-server`;
  logger.info(`Calling service C at ${urlC}`);
  const servicecResponse = await fetch(urlC, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tokenForC}`,
    },
  });

  const jsonFromB = await servicebResponse.json();
  const jsonFromC = await servicecResponse.json();

  res.json({ serviceb: jsonFromB, servicec: jsonFromC });
});

// This is the endpoint that gets called by /scenario2; the instance that this is called on is either serviceb or servicea
app.get("/scenario2-server", async (req, res) => {
  const token = getTokenFromHeader(req);

  if (!token) {
    logger.info("No token provided");
    return res.status(401).json({ message: "no token provided" });
  }

  logger.info(`Verifying token by making a call to ${process.env.JWT_FACTORY_ENDPOINT}`);

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, aud: SERVICE_NAME, sub: "servicea" }),
  };

  // We're verifying token is signed by servicea key and it has the correct audience and subject claims
  const url = `${process.env.JWT_FACTORY_ENDPOINT}/verify/servicea`;

  const verifyResult = await fetch(url, options);
  const verifyResultJson = await verifyResult.json();

  if (!verifyResultJson.valid) {
    logger.info("Invalid token");
    return res.status(403).json({ message: `invalid token`, ...verifyResultJson });
  }

  logger.info("Valid token");
  res.send(verifyResultJson);
});

// Service A has it's own public/private key and uses it to sign a JWT for service B (e.g. "aud:svcB, sub:svcA")
// Service a makes a call to service b, service B uses service A's public key to verify the JWT.
app.get("/scenario3", async (req, res) => {
  const expiredToken = Boolean(req.query.expired);

  // Load the private key from the file specified in SERVICE_A_PRIVATE_KEY_PATH
  const privateKey = fs.readFileSync(process.env.SERVICE_A_PRIVATE_KEY_PATH);

  // create and sign a JWT
  const jwttoken = createJwt(privateKey, { sub: "servicea", aud: "serviceb" }, expiredToken);

  logger.info(`Created JWT: ${jwttoken}`);

  // Make a call to serviceb with the token
  const options = {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwttoken}`,
    },
  };

  const url = `${process.env.SERVICE_B_ENDPOINT_HTTPS}/scenario3-server`;
  logger.info(`Calling serviceb at ${url}`);
  const result = await fetch(url, options);
  const claims = await result.json();
  res.send(claims);
});

app.get("/scenario3-server", async (req, res) => {
  const token = getTokenFromHeader(req);
  const publicKey = fs.readFileSync(process.env.SERVICE_A_PUBLIC_KEY_PATH);
  const result = await verifyJwt(publicKey, token, { sub: "servicea", aud: "serviceb" });

  res.json(JSON.stringify(result));
});

// Service A has it's own public/private key and uses it to sign a JWT for service B (e.g. "aud:svcB, sub:svcA") and service C ("aud:svcC, sub:svcA")
// Service a makes a call to service b and service c, both services use service A's public key to verify the JWT.
app.get("/scenario4", async (req, res) => {
  const expiredToken = Boolean(req.query.expired);

  // Load the private key from the file specified in SERVICE_A_PRIVATE_KEY_PATH
  const privateKey = fs.readFileSync(process.env.SERVICE_A_PRIVATE_KEY_PATH);

  // create and sign a JWT for service B
  const jwttokenServiceB = createJwt(privateKey, { sub: "servicea", aud: "serviceb" }, expiredToken);

  // create and sign a JWT for service C
  const jwttokenServiceC = createJwt(privateKey, { sub: "servicea", aud: "servicec" }, expiredToken);

  logger.info(`Created two JWTs:\nService B\n${jwttokenServiceB}\nService C\n${jwttokenServiceC}`);

  // Make a call to serviceb with the token
  const url = `${process.env.SERVICE_B_ENDPOINT_HTTPS}/scenario4-server`;
  logger.info(`Calling serviceb at ${url}`);
  const resultB = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwttokenServiceB}`,
    },
  });
  const claimsB = await resultB.json();

  const urlC = `${process.env.SERVICE_C_ENDPOINT_HTTPS}/scenario4-server`;
  logger.info(`Calling servicec at ${urlC}`);
  const resultC = await fetch(urlC, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwttokenServiceC}`,
    },
  });
  const claimsC = await resultC.json();

  res.send({ serviceB: claimsB, serviceC: claimsC });
});

app.get("/scenario4-server", async (req, res) => {
  const token = getTokenFromHeader(req);
  const publicKey = fs.readFileSync(process.env.SERVICE_A_PUBLIC_KEY_PATH);
  const result = await verifyJwt(publicKey, token, { sub: "servicea", aud: process.env.SERVICE_NAME });

  res.json(result);
});

app.post("/gen-keys", async (req, res) => {
  // Generate a public and private key pair
  const jwtKeyPair = createKeyPair();
  logger.info(`Generated key pair`);

  // Save the keys to files
  const folder = saveKeysToFiles(jwtKeyPair, "jwt");

  // Also create a public/private key pair for the server
  const serverKeyPair = createKeyPair();
  saveKeysToFiles(serverKeyPair, "server");

  res.send({ folder });
});

app.get("/hello", async (req, res) => {
  res.send("hello");
});
