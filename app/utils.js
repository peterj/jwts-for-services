const { logger } = require("./logger");

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

module.exports = {
  getTokenFromJWTFactory,
  getTokenFromHeader,
};
