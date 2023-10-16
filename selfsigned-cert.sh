#!/bin/bash

export DNS_NAME=webuitest.com
export ROOT_CERT_NAME=gateway-root
export SERVER_CERT_NAME=istio-ingressgateway
export CLUSTER_NAME=mycluster

openssl req -new -newkey rsa:4096 -x509 -sha256 \
    -days 3650 -nodes -out ${ROOT_CERT_NAME}.crt -keyout ${ROOT_CERT_NAME}.key \
    -subj "/CN=$DNS_NAME/O=${ROOT_CERT_NAME}" \
    -addext "subjectAltName = DNS:$DNS_NAME"

# server cert
cat > "${SERVER_CERT_NAME}.conf" <<EOF
[req]
req_extensions = v3_req
distinguished_name = req_distinguished_name
[req_distinguished_name]
[ v3_req ]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
extendedKeyUsage = clientAuth, serverAuth
subjectAltName = @alt_names
[alt_names]
DNS = $DNS_NAME
EOF

openssl genrsa -out "${SERVER_CERT_NAME}.key" 2048
openssl req -new -key "${SERVER_CERT_NAME}.key" -out ${SERVER_CERT_NAME}.csr -subj "/CN=$DNS_NAME/O=${SERVER_CERT_NAME}" -config "${SERVER_CERT_NAME}.conf"
openssl x509 -req \
  -days 3650 \
  -CA ${ROOT_CERT_NAME}.crt -CAkey ${ROOT_CERT_NAME}.key \
  -set_serial 0 \
  -in ${SERVER_CERT_NAME}.csr -out ${SERVER_CERT_NAME}.crt \
  -extensions v3_req -extfile "${SERVER_CERT_NAME}.conf"