# BikeOS JARVIS — Final build

A self-contained, installable motorcycle dashboard designed for a Samsung Galaxy A73 mounted on a TVS Ronin.

## Features that work
- GPS speed display (device GPS; approximate, not calibrated vehicle speed)
- GPS accuracy and coordinates
- Ride session timer, approximate distance, average and maximum GPS speed
- Ride history saved locally in the browser
- Google Maps handoff using current GPS coordinates
- Current weather lookup through Open-Meteo when online
- Battery level where Android/browser exposes the Battery Status API
- Screen Wake Lock where supported
- Music-service shortcuts
- Voice commands where Chrome's Speech Recognition API is available
- PWA installation and cached dashboard shell

## Honest platform limits
This is a phone-based web app, not Android Auto/CarPlay and not connected to the Ronin ECU. A browser cannot reliably control arbitrary third-party music apps, read fuel/ABS/engine data, or guarantee background GPS tracking while Android suspends the page. Google Maps opens separately. Voice recognition and battery status depend on browser/Android support. Weather requires internet. Ride logs are local to this browser and can be lost if site data is cleared.

## Deploy
1. Upload the contents of this folder to the root of a GitHub repository.
2. GitHub → Settings → Pages → Deploy from a branch → `main` → `/ (root)`.
3. Open the HTTPS Pages URL in Chrome on the A73.
4. Allow location permission; install from Chrome menu → Install app / Add to Home screen.
5. Test GPS outdoors with the phone stationary before relying on it.

## Android setup
- Enable Location and allow Chrome location access.
- Pair helmet Bluetooth in Android Settings.
- Disable battery optimization for Chrome during rides if GPS tracking is interrupted.
- Use a vibration-isolated phone mount. Prolonged motorcycle vibration can damage phone camera stabilization hardware.
- Use a fused, regulated, ignition-switched USB supply installed by a qualified technician. Keep wiring clear of steering, brakes and controls.
- Never interact with the screen while riding. Configure and start navigation before moving.
