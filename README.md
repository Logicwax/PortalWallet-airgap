# Portalwallet-airgap

Builds a full bootable, immutable, reproducible disk image that boots directly into [PortalWallet](https://github.com/Logicwax/PortalWallet/tree/master), for cold/offline use on an airgapped laptop.  Compatible with secureboot (via debian shim) or bring your own key and do full unified kernel image signing with MOK enrollment or hash enrollment.

Based on the [kiosk](https://github.com/Logicwax/kiosk/) project.

The image is built **reproducibly**: independent builds of the same commit produce a
byte-identical `.img`. Everything is compiled inside pinned Docker builder images.  Build in CI, at home, or in cloud VMs to arrive at the same hash and ensure no build-time tampering.

## Requirements

**`make setup` does all of this for you.** It checks what is already present,
installs what is missing, verifies you can reach the Docker daemon,
enables the Docker feature, and creates the pinned
builder - then verifies the result. It is idempotent, so re-running it on a
configured host reports OK and changes nothing. Anything that touches the host
(a package install, writing `/etc/docker/daemon.json`, restarting Docker) prints
what it will do and asks first; `FORCE=1 make setup` answers yes to all of them,
for unattended use. `daemon.json` is merged with `jq` and backed up, never
overwritten.

```bash
make setup
```

The manual equivalents are below, if you would rather do it yourself or need to
see exactly what `make setup` changes:

- Linux host with Docker
- **Your user must be in the `docker` group.** The daemon socket is
  `root:docker`, so having the `docker` CLI on `PATH` is not the same as being
  able to use it — without membership every build fails with a permission error
  on `/var/run/docker.sock`.

    ```bash
    sudo usermod -aG docker "$USER"
    ```

    Group changes do **not** apply to your current shell: log out and back in, or
    run `newgrp docker`, before building. (`make setup` checks this, offers to add
    you, and tells you to re-login.)
- **`containerd-snapshotter` enabled.** Create `/etc/docker/daemon.json` with:

    ```json
    {
      "features": {
        "containerd-snapshotter": true
      }
    }
    ```

    then `sudo systemctl restart docker`. Without it Docker uses the legacy
    graphdriver, which does not preserve image digests through `docker load`, so a
    locally built builder image can differ from the same image elsewhere.

- Buildx `docker-container` driver, with BuildKit pinned so the builder itself is
  not a moving part:

```bash
docker buildx create \
  --name reproducible-builder \
  --driver docker-container \
  --driver-opt image=moby/buildkit:v0.26.2 \
  --use && \
docker buildx inspect --bootstrap reproducible-builder
```

- `qemu-system-x86` + `ovmf` (only to boot-test), `jq`, `git`

```bash
sudo apt-get install docker.io qemu-system-x86 ovmf jq git
```

## Build

```bash
make build                      # -> build/portalwallet-v<VERSION>.img
make verify                     # verify the untampered image
DISK=/dev/sdX make flash-disk   # write it to a USB stick
make test-boot                  # boot it in QEMU (for testing purposes)
```
## Boot chains

`BOOT` picks the boot chain; `BOOTSIGN` only applies to `BOOT=uki`.

| command | boot chain | Secure Boot on a stock laptop | reproducible |
|---|---|---|---|
| `make build` | **grub** (default) | ✅ boots, **nothing to enroll** | ✅ |
| `make build BOOT=uki` | unsigned UKI | ⚠️ needs a *hash* enroll, per image, per machine | ✅ |
| `make build BOOT=uki BOOTSIGN=yes` | signed UKI | ⚠️ needs a *certificate* enroll, once per machine | ❌ |


**`BOOT=uki`** seals kernel + initrd + cmdline into one EFI-stub binary, so a single
signature covers all three (Which then requires MOK enrollment at first boot, using the
included/integrated Mokutil), because shim does not trust a custom chosen
key.

`BOOTSIGN=yes` needs `os-builder/secureboot/portalwallet.{key,crt}` (make one with
`make secureboot-key`).

> [!NOTE]
> Only `BOOTSIGN=yes` is non-reproducible: an Authenticode
signature embeds a signing timestamp which is mutually exclusive with full image reproducibility.

## Attestation

Every build writes `attestation/manifest.txt` — the sha256 of the `.deb` and the
`.img`. Whoever builds can sign it, and anyone can re-check those signatures later.

```bash
make build          # writes attestation/manifest.txt
make sign           # signs it -> attestation/signatures/manifest.<KEYID>.asc
make verify         # re-checks every signature against the current manifest
```

Signatures are verified in an **isolated keyring built only from
`attestation/signers/`**, so a signature from any other key is reported as
`NOT A SIGNER` and does not count.



## Layout

```
Makefile                    # build / flash / test-boot / lock-update targets
VERSION                     # image version string
app/                        # minimal Electron app (main.js + src/)
deb-builder/                # pinned builder image that compiles the app -> .deb
  Dockerfile, build-deb.sh, pkgs.list, lock/, scripts/
os-builder/                 # pinned builder image that assembles the OS image
  Dockerfile, build-os.sh
  genimage-grub.cfg         # ESP layout for BOOT=grub
  genimage-uki.cfg          # ESP layout for BOOT=uki
  rootfs-packages.list      # what ships INSIDE the image
  ansible/                  # roles: common -> portalwallet -> cleanup (config only)
  lock/, scripts/, secureboot/
```
