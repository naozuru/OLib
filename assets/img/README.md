# School logo

Put your logo file in this folder, for example `logo.png` (a square image with a transparent
background looks best, around 256 x 256 px; PNG, SVG or WebP all work).

Then open `assets/js/config.js` and set:

```js
LOGO_URL: 'assets/img/logo.png',
```

The logo then replaces the book icon in the header of the student pages, the sidebar and sign-in page
of the admin area, and it is used as the browser tab icon (favicon). To use a different image for the
tab icon, also set `FAVICON_URL`. If the file cannot be loaded, the book icon is shown instead.
