// Renderer entry for @electron-forge/plugin-webpack.
//
// Deliberately does NOT import ./style.css. That file is a leftover from the
// kiosk template this repo was cloned from (it styles a `.stage` element with a
// centred <h1>), and portalwallet.html is a self-contained page with its own
// markup and inline styles — no `.stage` anywhere. Importing it would inject
// `html,body { height:100%; margin:0 }` into the page and change its layout.
//
// The CSS loader rule is still configured in webpack.renderer.config.js, so
// `import './some.css'` here works the moment this app grows a real stylesheet.
