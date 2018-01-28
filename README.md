## Auto-promoter/reattacher

- Reads from a list of bundle hashes and tries to promote associated transactions. In case it fails, reattaches them.
- Checks for confirmed transactions and remove them from the list of unconfirmed bundle hashes.
- Prepares a list of bundle hashes that fail to get promoted and reattached.


### Getting started

```
yarn
```

To auto-reattach/promote all unconfirmed transactions
```
yarn index.js --all
```

To auto-reattach/promote only failed transactions
```
yarn index.js --f
```

#### Note: All paths are for files are defined in `config.js`
