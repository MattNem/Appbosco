// FILE: sw.js (Service Worker)

const CACHE_NAME = 'orto-frutteto-pwa-cache-v1';
// List of files to cache immediately during install
const urlsToCache = [
  '/', // Cache the root URL
  '/index.html', // Cache the main HTML file
  'https://cdn.tailwindcss.com', // Cache Tailwind CSS (consider self-hosting or versioning)
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap', // Cache font CSS
  // Add other essential assets like specific font files if preloaded, icons, manifest.json
  '/manifest.json'
  // '/style.css', // If you have a separate CSS file
  // '/script.js' // If you have a separate JS file
];

// Install event: Cache core assets
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        // Use addAll for atomic caching - fails if any request fails
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: App shell cached successfully');
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
      .catch(error => {
          console.error('Service Worker: Caching failed', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
        console.log('Service Worker: Claiming clients');
        // Take control of all open clients (tabs) immediately
        return self.clients.claim();
    })
  );
});

// Fetch event: Serve cached content when offline (Cache-first strategy)
self.addEventListener('fetch', event => {
    // Let the browser handle requests for non-GET methods
    if (event.request.method !== 'GET') {
        return;
    }

    // For navigation requests (HTML pages), try network first, then cache.
    // This ensures users get the latest HTML if online.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request)
                .catch(() => {
                    // If network fails, serve the main index.html from cache
                    return caches.match('/index.html');
                })
        );
        return;
    }

    // For other requests (CSS, JS, images, fonts), use Cache-first strategy
    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Cache hit - return response
                if (cachedResponse) {
                    // console.log('Service Worker: Serving from cache:', event.request.url);
                    return cachedResponse;
                }

                // Not in cache - fetch from network
                // console.log('Service Worker: Fetching from network:', event.request.url);
                return fetch(event.request).then(
                    networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic' && networkResponse.type !== 'cors') {
                             // Don't cache opaque responses (like from CDNs without CORS) unless necessary
                            return networkResponse;
                        }

                        // IMPORTANT: Clone the response. A response is a stream
                        // and because we want the browser to consume the response
                        // as well as the cache consuming the response, we need
                        // to clone it so we have two streams.
                        const responseToCache = networkResponse.clone();

                        caches.open(CACHE_NAME)
                            .then(cache => {
                                // console.log('Service Worker: Caching new resource:', event.request.url);
                                cache.put(event.request, responseToCache);
                            });

                        return networkResponse;
                    }
                ).catch(error => {
                    console.error('Service Worker: Fetch failed; returning offline page instead.', error);
                    // Optional: Return a custom offline fallback page or image
                    // if (!event.request.url.includes('.html')) { // Don't return offline page for assets
                    //     return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
                    // }
                    // return caches.match('/offline.html'); // You would need to cache an offline.html page
                });
            })
    );
});