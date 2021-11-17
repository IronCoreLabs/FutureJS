# Changelog

## 2.2.0

### Additions

-   made `Future` `Thenable`, so `await` can used with it and it can be chained with `Promises`. `await` will immediately kick off the `Future`, similarly to `engage`.

## 2.1.2

### Fixes

-   fixed a bug in `Future.all` that prevented an empty array from ever resolving.
