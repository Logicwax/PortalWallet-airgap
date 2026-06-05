# Portalwallet-airgap

Builds a full bootable disk image that boots directly into [Portalwallet](https://github.com/Logicwax/PortalWallet/tree/master) for use on an airgapped-laptop for cold/offline/airgapped use.


This project is based on the [kiosk](https://github.com/Logicwax/kiosk/) project.

## Requirements

- Debian/Ubuntu host with QEMU + KVM
- `ovmf`, `ansible`, `packer`, `jq`, `curl`

```bash
sudo apt-get install qemu-system-x86 qemu-utils ovmf ansible packer jq curl
packer plugins install github.com/hashicorp/qemu
packer plugins install github.com/hashicorp/ansible
```

## Build

```bash
make            # -> build/portalwallet-v<VERSION>.raw (+ .raw.gz)
```

## Test in a VM

```bash
make test-boot          # EFI
make test-boot-legacy   # legacy BIOS
```

## Flash to a disk

```bash
DISK=/dev/sdX make flash-disk
```
