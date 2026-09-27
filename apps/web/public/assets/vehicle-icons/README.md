# Vehicle icon asset guide

Use this directory for RI-owned or properly licensed artwork. Do not copy image files from another product's CDN unless you have written permission or a licence that allows use in this application.

## Vehicle images

Put each transparent PNG in the matching directory under `vehicles/`:

```text
vehicles/
  bike/
  car/
  scooter/
  ev-scooter/
  three-wheeler/
  bus/
  truck/
  van/
```

Create these four required transparent PNGs in every vehicle directory:

```text
running.png       green vehicle
stopped.png       red vehicle
idle.png          yellow vehicle
unreachable.png   blue vehicle
```

The code mapping will be:

| Tracker state | Image |
| --- | --- |
| Moving/running and sending data | `running.png` |
| Ignition off and tracker sending data | `stopped.png` |
| Ignition on with no movement | `idle.png` |
| No tracker packet for 30 minutes | `unreachable.png` |

`default.png` is optional and can be used while a state-specific image is unavailable. With the initial four-image set, overspeed will use `running.png`, while new/inactive trackers will use `unreachable.png`. Separate artwork can be added later if desired.

Example paths:

```text
/assets/vehicle-icons/vehicles/car/running.png
/assets/vehicle-icons/vehicles/scooter/stopped.png
/assets/vehicle-icons/vehicles/ev-scooter/unreachable.png
/assets/vehicle-icons/vehicles/three-wheeler/idle.png
```

## Status and metric images

- Put dashboard filter artwork in `status/` using `all.png`, `overspeed.png`, `running.png`, `idle.png`, `stopped.png`, `unreachable.png`, `new.png`, and `inactive.png`.
- Put popup/detail artwork in `metrics/` using `speed.png`, `today-km.png`, `status.png`, `since.png`, `location.png`, `last-update.png`, and `address.png`.

## Image specification

- Vehicle images: transparent PNG, 512 × 384 pixels, 4:3 canvas.
- Status images: transparent PNG, 256 × 256 pixels.
- Metric images: transparent PNG, 128 × 128 pixels.
- Use sRGB colour and keep important artwork at least 16 pixels from every edge.
- Keep the same camera angle, scale, lighting, and shadow direction across all vehicle types.
- Do not include brand logos, registration plates, watermarks, text, or another application's marks.
- Keep filenames lowercase and use hyphens instead of spaces.

Record the creator, source, licence, and creation date in [`ASSET-LICENSES.md`](ASSET-LICENSES.md) before an image is released.
