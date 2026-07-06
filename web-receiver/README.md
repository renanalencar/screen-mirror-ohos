This folder is configured to be a git submodule pointing at the upstream
repository `git@github.com:renanalencar/screen-mirror-receiver.git`.

To add the submodule and populate this folder locally, run:

```bash
git submodule add git@github.com:renanalencar/screen-mirror-receiver.git web-receiver
git submodule update --init --recursive
```

Existing contents were backed up to `web-receiver.orig/` in this repository.

If you prefer the backup restored instead of using the submodule, copy files
from `web-receiver.orig/` back into this folder.
