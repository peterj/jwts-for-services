function isAuthenticated(req) {
    if (Boolean(process.env.SHOULD_AUTHENTICATE)) {
        return req?.oidc?.isAuthenticated()
    }

    if (!req?.headers?.jwt) {
        return false;
    }

    return true;
}

module.exports = {
    isAuthenticated
}