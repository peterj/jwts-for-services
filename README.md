# JWTs for service-to-service communication

This repo contains sample apps to demonstrate how to use JWTs for service-to-service communication. The apps are written in Node.js and use the `jsonwebtoken` library.

## jwt-factory endpoints

| Endpoint | Body | Description |
| --- | --- |--- |
| `GET /keys/:keyId` | - | Generates a new key pair that can be used to sign and verify JWTs with |
| `POST /issueToken/:keyId?{expired=1}` | Body can contain the claims to be included in the token (note the `iss` (default: `https://jwt-factory/`), `sub` (`keyId`) claims can be provided, but that will overwrite the default values) | Issues a JWT token signed with the provide key referenced by the `keyId`. The token will contain the claims specified in the body. If the `expired` query parameter is set to 1, the token will be issued with an expiration date in the past (i.e. expired token) |
| `POST /verify/:keyId` | Body contains the `token`, `aud`, and `sub` to verify | Verifies the token using the public key (referenced by `keyId`) and that the token contains the correct audience and subject claims |
| `GET /utils/publicKey/:keyId` | - | Returns the base64 encoded public key |
| `GET /utils/keys` | - | Returns the list of keyIds loaded by the instance |
| `POST /utils/dump` | Dumps/saves all private and public keys to the `/keys` folder |

## app endpoints

Note that the same app can be running as `servicea`, `serviceb`, or `servicec`. Use the `npm run servicea`, `npm run serviceb`, or `npm run servicec` to start the app as the desired service.

All environment variables for individual services are stored in the `.env` files.

| Endpoint | Description |
| --- | --- |
| `GET /scenario1{?expired=1}` | Runs the scenario one (see below). Use `expired=1` to have jwt-factory issue an expired token |
| `GET /scenario2{?expired=1}` | Runs the scenario two (see below). Provide `expired=1` to have jwt-factory issue an expired token |
| `GET /scenario3{?expired=1}` | Runs the scenario three (see below). Provide `expired=1` to have Service A issue an expired token |
| `GET /scenario4{?expired=1}` | Runs the scenario four (see below). Provide `expired=1` to have Service A issue an expired token |
| `GET /scenario1-server` | Runs as the response to `/scenario1` call on Service B. Note that this shouldn't be invoked directly |
| `GET /scenario2-server` | Runs as the response to `/scenario2` call on Service B. Note that this shouldn't be invoked directly |
| `GET /scenario3-server` | Runs as the response to `/scenario3` call on Service B. Note that this shouldn't be invoked directly |
| `GET /scenario4-server}` | Runs as the rersponse to `/scenario3` call on Service B and Service C. Note that this shouldn't be invoked directly |


# Build

To build the sample apps, go into `/app` and `/jwt-factory` folders and run `npm install`.

# Prerequisites

In the first two scenarios, Tte keys are created and managed centrally by the `jwt-factory` (i.e. the individual services don't have access to the keys). Another scenario would be where each service manages its own keys and can sign and verify tokens, without calling to the `jwt-factory` (Scenario 3).

1. Run the `jwt-factory` service:

```shell
# from the jwt-factory folder
npm install
npm run jwt-factory
```

1. Create the keys for Service A and Service B from the `jwt-factory` app:

```shell
curl localhost:5555/keys/servicea
curl localhost:5555/keys/serviceb

# Store the key pairs in the /keys folder (so next time you don't have to generate the keys)
curl -X POST localhost:5555/dump 
```

For Scenario 3, make sure you install [mkcert](https://github.com/FiloSottile/mkcert), so you can create the public/private key.

# Scenario 1

Service A calls the `jwt-factory` to request a token to access Service B. Note that the private and public keys are held at the `jwt-factory` app and neither of the services knows the keys.


1. Let's start Service A and Service B apps (from two different terminals):

```shell
# Run one command in each terminal window
npm install

npm run servicea
npm run serviceb
```

2. Send a request to Service A to start the scenario:

```shell
curl localhost:3000/scenario1
```

Here's what happened:

1. Service A made a call to the `jwt-factory` to request a token to access Service B (token with sub: servicea and aud: serviceb)

2. Service A used the token in the Authorization header to call Service B

3. Service B validated the token by making a call to the `jwt-factory` to verify the token was signed by Service A and it contains the correct audience and subject claims

## Expired token

To simulate an expired token flow, we can add the `?expired=1` when calling `/scenario1` endpoint. The steps are exactly the same as before, the difference is that Service A will be issued an expired token (i.e. simulating the expiration).

The response will look like this:

```shell
curl "localhost:3000/scenario1?expired=123"
```

```console
{"message":"invalid token","valid":false,"error":{"name":"TokenExpiredError", "message":"jwt expired","expiredAt":"2023-10-02T21:20:03.000Z"},"claims":{}}
```

# Scenario 2

In this scenario service A requests JWT tokens for service B and service C. Service A then calls service B and service C using the tokens and returns the results.

1. Let's start Service A, Service B and Service C apps (from three different terminals):

```shell
npm run servicea
npm run serviceb
npm run servicec
```

2. Send a request to Service A to start the scenario:

```shell
curl localhost:3000/scenario2
```

Here's what happened:

1. Service A made a call to the `jwt-factory` to request a token to access Service B (token with `sub: servicea` and `aud: serviceb`)
2. Service A made a call to the `jwt-factory` to request a token to access Service C (token with `sub: servicea` and `aud: servicec`)
3. Service A used the token in the Authorization header to call Service B
4. Service A used the token in the Authorization header to call Service C
5. Service A returned the results from Service B and Service C

The output includes the responses from both services:

```console
{"serviceb":{"valid":true,"claims":{"iss":"https://jwt-factory/","sub":"servicea","aud":"serviceb","exp":1696290884,"iat":1696287284}},"servicec":{"valid":true,"claims":{"iss":"https://jwt-factory/","sub":"servicea","aud":"servicec","exp":1696290884,"iat":1696287284}}}
```

You can add the `?expired=1` to the request to simulate the expiration of one of the tokens.
# Scenario 3

In this scenario, Service A has it's own public/private key and uses it to sign the JWTs. Ideally, the JWT expiration should be measured in seconds and have the `aud` and `sub` claims set accordingly. Service B then uses service A's public key to verify the JWT.

At a minimum we also have to use a one-way TLS to protect the JWT.

The key rotation would include rotating the keys as Service A, but also updating the Service B with the public key (so it can verify tokens from A are signed with the correct key).

1. Run both services from two separate terminals:

```shell
# Terminal 1
npm run servicea

# Terminal 2
npm run serviceb
```

2. Create the public/private key for TLS (run from the `/app` folder):

```shell
mkcert -key-file key.pem -cert-file cert.pem localhost
```

3. Create the public/private key for signing JWT tokens (run from the `/app` folder):

```shell
curl -X POST localhost:3000/gen-keys
```

>The above request will create a public and private key in the `/scenario-3-keys` folder. This is where both instances of the app will read the keys from (service A will read the private key to sign the JWTs, and service B will read the public key to verify the signature).


To run the scenario, you can send the request to `localhost:3000/scenario3`. Here's what happens:

From Service A (client):

1. Service A will load the private key from the `scenario-3-keys` folder.
2. Service A creates and signs a JWT token (`sub: servicea`, `aud: serviceb`) with the private key.
3. Service A sends a GET request with the JWT token in the headers to the `https://` endpoint (e.g. `https://localhost:8443/scenario3-server`).

From Service B (server):

1. Service B reads the token from the Authorization header.
2. Service B reads the public key from the `scenario-3-keys` folder.
3. Service B uses the JWT library to verify the JWT token was signed with the correct key, and that it includes the correct `sub` and `aud` claims.
4. Service B responds with the JWT verification result.

The output from the call will look like this:

```console
curl localhost:3000/scenario3
{"valid":true,"claims":{"iss":"https://service-issuer","sub":"servicea","aud":"serviceb","exp":1696879104,"iat":1696875504}}
```

You can also check the logs from both services to see what was happening.

To test the scenario with an expired token, send the request like this: `curl localhost:3000/scenario3?expired=1` - this will issue an expired token, which will fail the request:

```console
"valid":false,"error":{"name":"TokenExpiredError","message":"jwt expired","expiredAt":"2023-10-09T17:38:41.000Z"},"claims":{}}
```

# Scenario 4

This scenario is similar to the previous one, but in this case Service A is signing the JWTs for two services - service B and service C. The flow is exactly the same, each receiving service has access to the Service A's public key to verify the issued JWTs.

>For the sake of simplicity Service B and Service C are using the same TLS certificates (using the `localhost`), in reality you'd have separate TLS certs for each of the services.
