#!/bin/bash
docker buildx build --platform linux/amd64 -t pj3677/backend-api --push .
