// The site may be served under a sub-path (GitHub Pages, task 5.7): data/ and assets/ are read from there.

/** URL of a file copied beside the app, from its path in the project (`data/units.json`). */
export const staticUrl = (path: string) => import.meta.env.BASE_URL + path;
