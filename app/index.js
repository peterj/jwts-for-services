const express = require("express");

const { logger, expressWinstonLogger } = require("./logger");
const { getTokenFromJWTFactory, getTokenFromHeader } = require("./utils");

const app = express();
const port = process.env.PORT ?? 3000;
const SERVICE_NAME = process.env.SERVICE_NAME;

app.use(expressWinstonLogger);

// Steps:
// 1. Service requests a token from the JWT factory, so it can call serviceb
// 2. Service calls serviceb with the token
// 3. Serviceb verifies the token and returns the claims (or an error)
app.get("/scenario1", async (req, res) => {
  const expiredToken = Boolean(req.query.expired);
  const token = await getTokenFromJWTFactory({
    sub: SERVICE_NAME,
    aud: "serviceb",
  }, expiredToken);

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
    body: JSON.stringify({ token, aud: SERVICE_NAME, sub: 'servicea' }),
  };

  // We're verifying token is signed by servicea key and it has the correct audience and subject claims
  const url = `${process.env.JWT_FACTORY_ENDPOINT}/verify/servicea`;

  const verifyResult = await fetch(url, options);
  const verifyResultJson = await verifyResult.json();

  if (!verifyResultJson.valid) {
    logger.info("Invalid token");
    return res.status(403).json({ message: `invalid token`,  ...verifyResultJson });
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

  const tokenForC = await getTokenFromJWTFactory({
    sub: SERVICE_NAME,
    aud: "servicec",
  }, expiredToken);
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
})

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
    return res.status(403).json({ message: `invalid token`,  ...verifyResultJson });
  }

  logger.info("Valid token");
  res.send(verifyResultJson);
});

app.listen(port, () => {
  logger.info(`App ${SERVICE_NAME} listening on port ${port}`);
  logger.info(`Running ${SERVICE_NAME}`);
});
