# JWTs for service-to-service communication

This repo contains sample apps to demonstrate how to use JWTs for service-to-service communication and how to use Istio with RequestAuthentication and AuthorizationPolicies. All apps are written in Node.js and use the `jsonwebtoken` library.


# JWT scenarios

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


## Build

To build the sample apps, go into `/app` and `/jwt-factory` folders and run `npm install`.

## Prerequisites

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

## Scenario 1

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

### Expired token

To simulate an expired token flow, we can add the `?expired=1` when calling `/scenario1` endpoint. The steps are exactly the same as before, the difference is that Service A will be issued an expired token (i.e. simulating the expiration).

The response will look like this:

```shell
curl "localhost:3000/scenario1?expired=123"
```

```console
{"message":"invalid token","valid":false,"error":{"name":"TokenExpiredError", "message":"jwt expired","expiredAt":"2023-10-02T21:20:03.000Z"},"claims":{}}
```

## Scenario 2

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
## Scenario 3

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

## Scenario 4

This scenario is similar to the previous one, but in this case Service A is signing the JWTs for two services - service B and service C. The flow is exactly the same, each receiving service has access to the Service A's public key to verify the issued JWTs.

>For the sake of simplicity Service B and Service C are using the same TLS certificates (using the `localhost`), in reality you'd have separate TLS certs for each of the services.

# Istio scenarios

What follows are the scenarios using Istio service mesh and Gloo Gateway. Both scenarios show how to configure user authentication (using JWTs) and authorization policies that combine both user and service auth. In lieu of using JWTs for service-to-service communication, we're certificate and mutual TLS, which is enabled by default when you install Istio.

The following are the prerequisites for the scenarios:

- Kubernetes cluster with Istio installed
- `default` namespace labeled for Istio injection
- Auth0 account with configured application and API

Note that we're using `webuitest.com` as a domain name for the web UI. Make sure you update your `/etc/hosts` file to point the domain to the external IP of the ingress gateway.

Create the config map and secret with the Auth0 configuration:

```shell
# All these come from Auth0
export AUTH0_CLIENT_ID=<from Auth0>
export AUTH0_SECRET=<from Auth0>
export ISSUER_BASE_URL=<from Auth0>
export AUDIENCE=https://webui

# Ingress GW external IP
export BASE_URL=http://webuitest.com
```

```shell
# Create the secrets in a kubernetes Secret
kubectl create secret generic webui-auth0 \
    --from-literal=AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID \
    --from-literal=AUTH0_SECRET=$AUTH0_SECRET \
    --from-literal=RANDOM_SECRET=$(openssl rand -base64 32)

# Create other values in a ConfigMap
kubectl create configmap webui-config \
    --from-literal=ISSUER_BASE_URL=$ISSUER_BASE_URL \
    --from-literal=AUDIENCE=$AUDIENCE \
    --from-literal=BASE_URL=$BASE_URL
```

We can now deploy the `web-ui` application with `kubectl apply -f web-ui/deploy.yaml` and deploy the `backend` as well with `kubectl apply -f backend/deploy.yaml`.

Next, we can deploy the VirtualServices and the Gateway resource to expose the `webui` through the ingress gateway:

```shell
kubectl apply -f web-ui/istio.yaml
kubectl apply -f backend/istio.yaml
```

At this point we could navigate to `http://webuitest.com`, see the UI and results from both backend service and login to the UI.

Let's continue with an allow nothing policy, that denies all requests between services:

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: allow-nothing
  namespace: default
spec:
  {}
```

If we reload the web page, we'll get the `RBAC: access denied` error. With the allow nothing policy, we'll get an access denied right away - we can't even see the UI, let alone log in.

So let's create an AuthorizationPolicy that allows calls from the Istio ingress gateway to the `webui`:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-ingress-gateway
  namespace: default
spec:
  selector:
    matchLabels:
      app: webui
  action: ALLOW
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/istio-system/sa/istio-ingressgateway-service-account"]
```

This time, we can get to the UI, but calls to both backend services fail with 403 errors. This is still because of the allow nothing policy. Let's create another AuthorizationPolicy that allows calls from the `webui` to the `backend-api`:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-webui-to-backend
  namespace: default
spec:
  selector:
    matchLabels:
      app: backend-api
  action: ALLOW
  rules:
    - from:
      - source:
          principals: ["cluster.local/ns/default/sa/webui"]
```

This time, we can get the response back from the `backend-api` service.

So far, we've only configured authorization policy that allows or denies access based on which service is calling.

Since we've implemented user authentication, let's see how we can add an authorization policy that allows access only to logged-in users.

Let's start by creating an RequestAuthentication policy that requires a JWT token to be present in the request from the `frontend` to the `backend`:

```yaml
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
 name: backend-api
spec:
  selector:
    matchLabels:
      app: backend-api
  jwtRules:
  - issuer: "https://dev-ccdkn3an01hhlwu5.us.auth0.com/"
    jwksUri: "https://dev-ccdkn3an01hhlwu5.us.auth0.com/.well-known/jwks.json"
```

With the above resource we're saying that we require all requests to the `backend-api` to have a JWT token that was issued and signed by the Auth0 tenant. The `jwksUri` is the public key that can be used to verify the JWT signature.

If we reload the page everything will still work and the reason for that is because we have to create an AuthorizationPolicy that makes use of the principal from the RequestAuthentication. We'll combine this with the allow-webui-to-backend policy we created earlier:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-webui-to-backend
  namespace: default
spec:
  selector:
    matchLabels:
      app: backend-api
  action: ALLOW
  rules:
    - from:
      - source:
          principals: ["cluster.local/ns/default/sa/webui"]
        source:
          requestPrincipals: ["*"]
```

The above AuthorizationPolicy applies to the `backend-api` and is saying that we're allowing (`action: ALLOW`) requests that have a valid principal set (i.e. the one that is issued and signed based on the rules we specified in the RequestAuthentication resource) AND the requests have to come from the `webui` service.

This time, it's not going to work - we'll get the same error in the UI as we did before. Additionally, if we check the logs from the sidecar proxy next to the `backend-api` pod, we'll see the 403 errors:

```console
"GET /data HTTP/1.1" 403 - rbac_access_denied_matched_policy[none] - "-" 0 19 0 - "-" "undici" "a0553520-baf2-9207-820a-ab81246ea1d4" "backend-api" "-" inbound|3000|| - 10.244.1.5:3000 10.244.1.7:49130 outbound_.80_._.backend-api.default.svc.cluster.local -
```

If we login to the UI, we'll see that the calls to the `backend-api` are now successful. This is because the UI is now sending the JWT token in the request to the `backend-api` and the token is valid.

Another test we can do is to try and send a request directly from the `webui` pod to the `backend-api` pod; we'll get the same RBAC error as before because we didn't provide a valid JWT token.  Similarly, if we'd use a valid JWT token, but signed by a different issuer, we'd get the following error:

```console
< HTTP/1.1 401 Unauthorized
< www-authenticate: Bearer realm="http://backend-api/data", error="invalid_token"
```

## Using Gloo Gateway

In this scenario, we'll use [Gloo Gateway](https://www.solo.io/products/gloo-gateway/) to expose the `webui` service and implement external auth flow. Previously, we've implemented the auth flow on the `webui` and the ingress gateway was just passing the request through. This time, we'll configure the gateway to redirect the user to Auth0 to login, and then back to the `webui` once authenticated. This way, the `webui` doesn't have to implement the auth flow at all as everything is done at the gateway level.

You can follow [these instructions](https://docs.solo.io/gloo-gateway/latest/getting_started/setup/) to install Gloo Gateway.

```shell
meshctl install --profiles gloo-gateway-demo \
  --set common.cluster=mycluster \
  --set licensing.glooGatewayLicenseKey=<license-key-here>
```

We'll be using a DNS name `webuitest.com` so we have to create a self-signed certificate for the domain. Make sure you also update your `/etc/hosts` file to point the domain to the external IP of the ingress gateway:

```shell
./selfsigned-cert.sh
```

Let's bring the certificate and key to the cluster by creating a Kubernetes secret:

```shell
kubectl create secret generic gw-ssl-1-secret \
--from-file=tls.key=${SERVER_CERT_NAME}.key \
--from-file=tls.crt=${SERVER_CERT_NAME}.crt \
--dry-run=client -oyaml | kubectl apply -f- \
--namespace gloo-mesh-gateways
```

We can now label the default namespace for injection and deploy the `webui` and `backend-api` services:

```shell
kubectl apply -f web-ui/deploy-gloo.yaml
kubectl apply -f backend/deploy.yaml
```

> Note the deployments are the same, the `-gloo.yaml` just doesn't include the references to Auth0 ConfigMap and Secret.

To expose the `webui` service through the gateway, we'll create a VirtualService and a RouteTable:

```yaml
apiVersion: networking.gloo.solo.io/v2
kind: VirtualGateway
metadata:
  name: istio-ingressgateway
spec:
  listeners: 
  - allowedRouteTables:
    - host: webuitest.com
    http: {}
    port:
      number: 443
    tls:
      mode: SIMPLE
      secretName: gw-ssl-1-secret
  - allowedRouteTables:
    - host: webuitest.com
    http: {}
    httpsRedirect: true
    port:
      number: 80
  workloads:
  - selector:
      labels:
        istio: ingressgateway
      cluster: mycluster
---
apiVersion: networking.gloo.solo.io/v2
kind: RouteTable
metadata:
  name: www-webuitest-com
spec:
  hosts:
    - webuitest.com
  # Selects the virtual gateway you previously created
  virtualGateways:
    - name: istio-ingressgateway
      namespace: default
  http:
    - name: webui
      matchers:
      - uri:
          prefix: /
          ignoreCase: true
      labels:
        # We'll refer to this label later when creating the auth configuration
        oauth: "true"
      forwardTo:
        destinations:
          - ref:
              name: webui
              namespace: default
            port:
              number: 80
```

>Setting a label on the route allows us to apply auth policies to specific routes.

We'll be using the external auth server that's provided by the Gloo Gateway. To do that, we create an ExtAuthServer resource that points to that auth service instance:

```yaml
apiVersion: admin.gloo.solo.io/v2
kind: ExtAuthServer
metadata:
  name: webui
  namespace: default
spec:
  destinationServer:
    port:
      number: 8083
    ref:
      cluster: mycluster
      name: ext-auth-service
      namespace: gloo-mesh-addons
```

What follows is the ExtAuthPolicy configuration - this is the same configuration we've done before, but at the `webui` application level (remember setting those environment variables).

We'll start by defining the `CLIENT_SECRET` and creating a secret with it:

```shell
export CLIENT_SECRET=<CLIENT_SECRET_HERE>

kubectl apply -f - <<EOF
apiVersion: v1
kind: Secret
type: extauth.solo.io/oauth
metadata:
  name: auth0-client-secret
  namespace: default
data:
  client-secret: $(echo -n ${CLIENT_SECRET} | base64)
EOF
```

Now we can create the ExtAuthPolicy resource and apply it to the route labeled with `oauth: true`:

```yaml
apiVersion: security.policy.gloo.solo.io/v2 
kind: ExtAuthPolicy
metadata: 
  name: webui-auth0
  namespace: default
spec: 
  applyToRoutes:
    - route:
        labels:
          oauth: "true"
  config: 
    glooAuth: 
      configs: 
      - oauth2: 
          oidcAuthorizationCode: 
            appUrl: https://webuitest.com
            callbackPath: /callback
            clientId: <INSERT AUTH0 CLIENT ID>
            # Reference to the secret we created earlier
            clientSecretRef: 
              name: auth0-client-secret
              namespace: default
            issuerUrl: <INSERT AUTH0 ISSUER URL>
            scopes:
            - openid
            - profile
            logoutPath: /logout
            # We're telling Gloo Gateway to put the id token into a header called `jwt`
            # and to put the access token into a header called `my_access_token`
            headers:
              idTokenHeader: "jwt"
              accessTokenHeader: "my_access_token"
            # We can also tell Gloo Gateway to extract specific claims from the JWT
            # and store them in headers.
            identityToken:
              claimsToHeaders:
                - claim: name
                  header: x-name
                - claim: nickname
                  header: x-nickname
                - claim: picture
                  header: x-picture
    # Lastly, we're referencing the auth server we created earlier
    server:
      name: webui
```

If you navigate to the URL (`https://webuitest.com`) you should be redirected to Auth0 to login, and after that back to the `webui`. The biggest difference in this scenario compared to the previous one is that Gloo Gateway is managing the user auth with Auth0. We don't have to implement the auth flow in the `webui` app at all.

We could now repeat the same steps we did previously, starting with enforcing the `allow-nothing` policy:

```yaml
apiVersion: security.istio.io/v1
kind: AuthorizationPolicy
metadata:
  name: allow-nothing
  namespace: default
spec:
  {}
```

Next, we can then create policies that explicitly allow calls from the ingress gateway ➡ `webui` and `webui` ➡ `backend-api`:

```yaml
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-ingress-gateway
  namespace: default
spec:
  selector:
    matchLabels:
      app: webui
  action: ALLOW
  rules:
  - from:
    - source:
        # Note this is different than before, because we're using Gloo Gateway
        principals: ["cluster.local/ns/gloo-mesh-gateways/sa/istio-ingressgateway-1-18-3-service-account"]
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: allow-webui-to-backend
  namespace: default
spec:
  selector:
    matchLabels:
      app: backend-api
  action: ALLOW
  rules:
    - from:
      - source:
          principals: ["cluster.local/ns/default/sa/webui"]
        source:
          requestPrincipals: ["*"]
---
apiVersion: security.istio.io/v1beta1
kind: RequestAuthentication
metadata:
 name: backend-api
spec:
  selector:
    matchLabels:
      app: backend-api
  jwtRules:
  - issuer: "https://dev-ccdkn3an01hhlwu5.us.auth0.com/"
    jwksUri: "https://dev-ccdkn3an01hhlwu5.us.auth0.com/.well-known/jwks.json"
```

We are also applying the request authentication policy; that way, even if the malicious agent gets inside the cluster, they won't be able to make calls to the `backend-api` without a valid JWT token.