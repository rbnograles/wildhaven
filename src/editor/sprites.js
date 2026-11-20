// Sprite pictures for the world editor's sharp view: loading each object's picture, drawing it
// where the game would, telling whether a click landed on its paint, and sorting the map's
// thousands of objects into squares so only the ones on screen are looked at.

/** Sprite name to picture address, the same folders the game's renderer reads. */
const URLS = Object.fromEntries(
  Object.entries(
    import.meta.glob('../../assets/world/source/objects/*/*.png', {
      eager: true,
      query: '?url',
      import: 'default',
    }),
  ).map(([path, url]) => [path.match(/([\w-]+)\.png$/)[1], url]),
);

/** The side of one bucket square, in world units. */
const BUCKET = 512;

/** A click this close to a small sprite's ground point picks it even if it missed the paint. */
const NEAR = 22;

/** A pixel counts as painted above this much alpha (0 to 255). */
const SOLID_ALPHA = 40;

/** The address of a sprite's picture, for thumbnails. */
export const spriteUrl = (name) => URLS[name];

/**
 * Sorts objects into a grid of squares by position.
 *
 * Like sorting post into pigeonholes by street: to find what is near a spot, only the nearby
 * holes are opened instead of going through all nine thousand objects.
 *
 * @param {object[]} objects - The objects to sort.
 * @returns {{near: Function}} `near(x0, y0, x1, y1)` lists the objects in the squares that
 *   touch that rectangle (a little more than the rectangle itself).
 */
export function bucketObjects(objects) {
  const grid = new Map();
  for (const o of objects) {
    const key = `${Math.floor(o.x / BUCKET)},${Math.floor(o.y / BUCKET)}`;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(o);
  }

  return {
    // Everything in the squares that touch the rectangle.
    near(x0, y0, x1, y1) {
      const out = [];
      for (let by = Math.floor(y0 / BUCKET); by <= Math.floor(y1 / BUCKET); by++)
        for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++)
          out.push(...(grid.get(`${bx},${by}`) ?? []));
      return out;
    },
  };
}

/**
 * Makes the comparison that puts objects in the order the game draws them.
 *
 * Path pieces go down first, then other flat things, then everything else from north to south,
 * so a tree further south is drawn over one behind it.
 *
 * @param {object} specs - The sprites of objects.json, by name.
 * @returns {(a: object, b: object) => number} A function for `Array.sort`.
 */
export function drawOrder(specs) {
  /** 0 for a path piece, 1 for another flat sprite, 2 for one that stands up. */
  const rank = (o) => (specs[o.name]?.path ? 0 : specs[o.name]?.flat ? 1 : 2);
  return (a, b) => rank(a) - rank(b) || a.y - b.y;
}

/**
 * Sets up sprite loading, drawing and hit testing.
 *
 * @param {object} specs - The sprites of objects.json: `origin`, `scale`, `flat`, `path`.
 * @param {() => void} onLoad - Called each time a picture finishes loading, to draw again.
 * @returns {{rect: Function, draw: Function, hits: Function}} The sprite tools.
 */
export function createSprites(specs, onLoad) {
  const images = new Map();
  const paint = new Map();

  /**
   * Gets a sprite's picture, starting to load it the first time it is asked for.
   *
   * @param {string} name - The sprite's name.
   * @returns {HTMLImageElement|null} The picture, or null while it is still loading.
   */
  function image(name) {
    let img = images.get(name);
    if (!img) {
      img = new Image();
      img.onload = onLoad;
      if (URLS[name]) img.src = URLS[name];
      images.set(name, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  /**
   * Works out the rectangle an object's picture covers in the world.
   *
   * @param {object} obj - The object.
   * @returns {{x: number, y: number, w: number, h: number, img: HTMLImageElement}|null} The
   *   rectangle in world units and the picture, or null while the picture is loading.
   */
  function rect(obj) {
    const img = image(obj.name);
    const spec = specs[obj.name];
    if (!img || !spec) return null;

    // An object from a map made in Tiled may have its own size (`scale`, see objectScale).
    const scale = (spec.scale ?? 1) * (obj.scale ?? 1);
    const w = img.naturalWidth * scale,
      h = img.naturalHeight * scale;
    return { x: obj.x - spec.origin[0] * w, y: obj.y - spec.origin[1] * h, w, h, img };
  }

  /**
   * Reads a picture's pixels once, so clicks can be tested against its paint.
   *
   * @param {string} name - The sprite's name.
   * @param {HTMLImageElement} img - Its loaded picture.
   * @returns {ImageData} The pixels.
   */
  function pixels(name, img) {
    if (!paint.has(name)) {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      paint.set(name, ctx.getImageData(0, 0, canvas.width, canvas.height));
    }
    return paint.get(name);
  }

  return {
    rect,

    // Draws one object where the game would, turned if it is a path piece.
    draw(ctx, obj, cam, alpha = 1) {
      const r = rect(obj);
      if (!r) return;
      ctx.globalAlpha = alpha;

      if (obj.rotation) {
        ctx.save();
        ctx.translate((obj.x - cam.x) * cam.scale, (obj.y - cam.y) * cam.scale);
        ctx.rotate((obj.rotation * Math.PI) / 180);
        ctx.drawImage(
          r.img,
          (r.x - obj.x) * cam.scale,
          (r.y - obj.y) * cam.scale,
          r.w * cam.scale,
          r.h * cam.scale,
        );
        ctx.restore();
      } else {
        ctx.drawImage(
          r.img,
          (r.x - cam.x) * cam.scale,
          (r.y - cam.y) * cam.scale,
          r.w * cam.scale,
          r.h * cam.scale,
        );
      }
      ctx.globalAlpha = 1;
    },

    // Says whether a world spot is on an object's paint (or right at a small sprite's foot).
    hits(obj, x, y) {
      if (Math.hypot(x - obj.x, y - obj.y) < NEAR) return true;
      const r = rect(obj);
      if (!r || x < r.x || y < r.y || x >= r.x + r.w || y >= r.y + r.h) return false;

      const data = pixels(obj.name, r.img);
      const px = Math.floor(((x - r.x) / r.w) * data.width),
        py = Math.floor(((y - r.y) / r.h) * data.height);
      return data.data[(py * data.width + px) * 4 + 3] > SOLID_ALPHA;
    },
  };
}
