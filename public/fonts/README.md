Drop the self-hosted font files in this folder structure:

- `public/fonts/manrope/manrope-400.woff2`
- `public/fonts/manrope/manrope-500.woff2`
- `public/fonts/manrope/manrope-600.woff2`
- `public/fonts/manrope/manrope-700.woff2`
- `public/fonts/manrope/manrope-800.woff2`
- `public/fonts/sora/sora-500.woff2`
- `public/fonts/sora/sora-600.woff2`
- `public/fonts/sora/sora-700.woff2`
- `public/fonts/sora/sora-800.woff2`

These match the weights currently used by the site.

After the files are in place and working, you can remove the Google Fonts `<link>` tags from:

- `src/views/partials/layout.eta`

The CSS is already prepared to prefer local files first and fall back to Google Fonts until you remove those links.
