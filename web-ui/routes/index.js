const router = require("express").Router();
const { requiresAuth } = require("express-openid-connect");
const { logger } = require("../logger");
const { isAuthenticated } = require("../utils");

const traceHeaders = ["x-request-id", "x-b3-traceid", "x-b3-spanid", "x-b3-parentspanid", "x-b3-sampled", "x-b3-flags", "b3", "x-ot-span-context"];

function getForwardHeaders(req) {
  const headers = {};

  for (let i = 0; i < 7; i++) {
    const traceHeader = traceHeaders[i];
    const value = req.get(traceHeader);

    if (value) {
      headers[traceHeader] = value;
    }
  }

  if (process.env.SHOULD_AUTHENTICATE) {
    const access_token = req.oidc?.accessToken?.access_token;
    if (access_token) {
      headers["Authorization"] = `Bearer ${access_token}`;
      logger.info(`Setting authorization header: ${access_token}`);
    } else {
      logger.info("No access token found");
    }
  } else {
    const jwtHeader = req.headers["jwt"];
    if (jwtHeader) {
      headers["Authorization"] = `Bearer ${req.headers["jwt"]}`;
    } else {
      logger.info("No JWT header found");
    }
  }

  return headers;
}

async function callService(headers, url) {
  logger.info(`Calling service ${url}.`);
  logger.info(`Attached headers: \n${JSON.stringify(headers)}`);

  const response = await fetch(url, {
    headers,
  });

  if (response.status !== 200) {
    return {
      error: `Service returned status ${response.status}`,
      result: null,
    };
  }

  const data = await response.json();
  return {
    error: null,
    result: data,
  };
}

router.get("/", async (req, res, next) => {
  const headers = getForwardHeaders(req);

  try {
    const firstServiceCallResult = await callService(headers, `${process.env.BACKEND_SERVICE_URL}/data`);
    const secondServiceCallResult = await callService(headers, `${process.env.SECOND_BACKEND_SERVICE_URL}/data2`);

    const results = {
      firstServiceUrl: `${process.env.BACKEND_SERVICE_URL}/data`,
      secondServiceUrl: `${process.env.SECOND_BACKEND_SERVICE_URL}/data2`,
      authenticated: isAuthenticated(),
      dataFromFirstService: JSON.stringify(firstServiceCallResult),
      dataFromSecondService: JSON.stringify(secondServiceCallResult),
      error: null,
    };

    logger.info(`Rendering index page with results: ${JSON.stringify(results)}`);

    res.render("index", results);
  } catch (err) {
    res.render("index", {
      error: err
    });

    logger.error(err);
  }
});

if (process.env.SHOULD_AUTHENTICATE) {
  router.get("/profile", requiresAuth(), async (req, res, next) => {
    res.render("profile", {
      userProfile: JSON.stringify(req.oidc.user, null, 2),
    });
  });
} else {
  router.get("/profile", async (req, res, next) => {
    const withoutQuotes = (str) => str.replace(/['"]+/g, "");
    const jwt_decode = require("jwt-decode");

    const decoded = jwt_decode(withoutQuotes(req.headers["jwt"]));
    res.render("profile", {
      userProfile: JSON.stringify(decoded, null, 2),
    });
  });
}

module.exports = router;
