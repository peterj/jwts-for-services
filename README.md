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
| `GET /scenario1{?expired=1}` | Runs the scenario one (see below). Use `expired=1` to have jwt-factory issue an expired token to service A |
| `GET /scenario2{?expired=1}` | Runs the scenario two (see below). Provide `expired=1` to have jwt-factory issue an expired token to service B |
| `GET /scenario1-server` | Runs as the response to `/scenario1` call on Service B. Note that this shouldn't be invoked directly |
| `GET /scenario2-server` | Runs as the response to `/scenario2` call on Service B and Service B. Note that this shouldn't be invoked directly |

# Build

To build the sample apps, go into `/app` and `/jwt-factory` folders and run `npm install`.

# Prerequisites

The keys are created and managed centrally by the `jwt-factory` (i.e. the individual services don't have access to the keys). Another scenario would be where each service manages its own keys and can sign and verify tokens, without calling to the `jwt-factory`.

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

1. Service A made a call to the `jwt-factory` to request a token to access Service B (token with sub: servicea and aud: serviceb)
2. Service A made a call to the `jwt-factory` to request a token to access Service C (token with sub: servicea and aud: servicec)
3. Service A used the token in the Authorization header to call Service B
4. Service A used the token in the Authorization header to call Service C
5. Service A returned the results from Service B and Service C

The output includes the responses from both services:

```console
{"serviceb":{"valid":true,"claims":{"iss":"https://jwt-factory/","sub":"servicea","aud":"serviceb","exp":1696290884,"iat":1696287284}},"servicec":{"valid":true,"claims":{"iss":"https://jwt-factory/","sub":"servicea","aud":"servicec","exp":1696290884,"iat":1696287284}}}
```

You can add the `?expired=1` to the request to simulate the expiration of one of the tokens.