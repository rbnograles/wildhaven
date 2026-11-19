# Wildhaven snowfall particle art

[Animated preview](snowfall-preview.html) · [PNG atlas](../../assets/world/source/effects/snowfall-particles.png) · [Crop metadata](../../assets/world/source/effects/snowfall-particles.json) · [Generation prompt](../../assets/world/source/effects/snowfall-particles.prompt.txt)

Generated with the built-in image-generation tool, using the approved character sheet as the style reference. The 1536 × 1024 RGBA source contains eight individual snow-particle variants in a 4 × 2 grid. These are particle textures, not successive animation frames. Full source resolution and original alpha are preserved.

Use the provided source rectangles to draw flakes at roughly 2–6 pixels (far), 6–12 pixels (middle), and 15–27 pixels (near) at the preview's 1100-pixel viewport width. The near flakes are softer and more transparent. Animate each particle downwards with slightly different speeds and gentle horizontal drift. Recycle flakes above the viewport rather than restarting a whole sprite sheet, so the snowfall can continue without a fixed loop boundary.

Intended game behavior: fade snowfall in when the active/visible biome is winter and fade it out when leaving. Render weather above the world and below the HUD, while the separate winter HUD skin supplies snow on the controls. If the camera can show two biomes at once, mask or blend the emitter to the visible snowy area. Respect the game's reduced-motion or weather-effects settings when connecting it.

The standalone preview implements motion and a manual biome toggle only. Runtime biome detection, world masking, and automatic HUD switching are not wired into the game by this asset task.
