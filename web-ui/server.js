require("dotenv").config();

const express = require("express");
const http = require("http");
const { logger, expressWinstonLogger } = require("./logger");
const path = require("path");
const expressLayouts = require("express-ejs-layouts");
const { auth } = require("express-openid-connect");

const router = require("./routes/index");

const app = express();

app.use(expressLayouts);
app.set("layout", "./layouts/default");
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

app.use(expressWinstonLogger);
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

const config = {
  // Applies to all paths (the ones we need auth for will have the middleware added)
  authRequired: false,
  auth0Logout: true,
  baseURL: process.env.BASE_URL,
  clientID: process.env.AUTH0_CLIENT_ID,
  secret: process.env.RANDOM_SECRET,
  clientSecret: process.env.AUTH0_SECRET,
  issuerBaseURL: process.env.ISSUER_BASE_URL,
  authorizationParams: {
    response_type: "code",
    audience: process.env.AUDIENCE,
    scope: "openid profile",
  },
};

const port = process.env.PORT ?? 8080;

if (Boolean(process.env.SHOULD_AUTHENTICATE)) {
  logger.info("Authenticating!");
  app.use(auth(config));
} else {
  logger.info("Not authenticating!");
}

// Make oidc.user available to all views
app.use(function (req, res, next) {
  if (process.env.SHOULD_AUTHENTICATE) {
    res.locals.user = req.oidc.user;
  } else {
    if (!req?.headers?.jwt) {
      res.locals.user = null;
    } else {
      res.locals.user = {
        name: req.headers["x-name"],
        picture: req.headers["x-picture"],
      };
    }
  }
  next();
});

app.use("/", router);

http.createServer(app).listen(port, () => {
  console.log(`WebUI running on ${port}`);
});
