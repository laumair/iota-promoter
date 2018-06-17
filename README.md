## Auto-promoter/reattacher

Reads ZMQ feed from a full node, store all unconfirmed transactions and promotes them till they get confirmed.

## Required Dependencies

- [Docker](https://docs.docker.com/engine/installation/)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Getting started

- Replace `ZMQ_HOST` with URL of a node with ZMQ enabled.
- Replace `IRI_NODE` with URL of a node running IRI.

``` shell
docker-compose up -d 
```
