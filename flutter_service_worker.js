'use strict';
const MANIFEST = 'flutter-app-manifest';
const TEMP = 'flutter-temp-cache';
const CACHE_NAME = 'flutter-app-cache';
const RESOURCES = {
  "version.json": "39fce46b2cdf22ad877b0da7cad3cfd5",
"canvaskit/canvaskit.wasm": "bf50631470eb967688cca13ee181af62",
"canvaskit/canvaskit.js": "2bc454a691c631b07a9307ac4ca47797",
"canvaskit/profiling/canvaskit.wasm": "95a45378b69e77af5ed2bc72b2209b94",
"canvaskit/profiling/canvaskit.js": "38164e5a72bdad0faa4ce740c9b8e564",
"favicon.ico": "ed891c2808e08e643294d4397fc0926a",
"flutter.js": "f85e6fb278b0fd20c349186fb46ae36d",
"index.html": "7c4e758c5b76ad1edfef168b1b0b274b",
"/": "7c4e758c5b76ad1edfef168b1b0b274b",
"manifest.json": "eb4bdadce82c5ed3cfc16cb78c17de5c",
"main.dart.js": "5d0525c1f5fab27a7a9d42f5f44ba2a0",
"assets/AssetManifest.json": "47b0f49efd02284158788b3d2c7838b4",
"assets/FontManifest.json": "dc3d03800ccca4601324923c0b1d6d57",
"assets/NOTICES": "586f0dec7ca72127191160e85319f7cc",
"assets/fonts/MaterialIcons-Regular.otf": "95db9098c58fd6db106f1116bae85a0b",
"assets/assets/parallax.png": "b438ce8dab83081e793da05d800f5d6b",
"assets/packages/cupertino_icons/assets/CupertinoIcons.ttf": "6d342eb68f170c97609e9da345464e5e",
"assets/shaders/ink_sparkle.frag": "e35b6596de523db6d8ed141b1569cb7a",
"icons/apple-icon-72x72.png": "99164664515885d41c0a1d417b9b25a8",
"icons/apple-icon-76x76.png": "dfa2177783d739081de49a93fcee1f22",
"icons/apple-icon-144x144.png": "57a923e265bab914c96dda17cf2b3179",
"icons/favicon-96x96.png": "3d136762dc56e58d9323ab9bb2b3106b",
"icons/android-icon-72x72.png": "99164664515885d41c0a1d417b9b25a8",
"icons/ms-icon-144x144.png": "798f88be7daa0c389e7cdc93df1e06bd",
"icons/apple-icon-152x152.png": "0c8e284ebdce111b9d9a95fbef70587f",
"icons/apple-icon-57x57.png": "d6ff15cc960ff331eb43b1c1649e48d3",
"icons/apple-icon-60x60.png": "fa3a3485f58806c0568ff2899092bead",
"icons/ms-icon-70x70.png": "5287ebe6a60e96c3d67bd93fa489cd51",
"icons/apple-icon-114x114.png": "78155c41b37ce6bca53f9f4f133b7c26",
"icons/apple-icon-precomposed.png": "12ee544fc9dd2fb6950485837cd1a6bb",
"icons/apple-icon.png": "12ee544fc9dd2fb6950485837cd1a6bb",
"icons/android-icon-48x48.png": "e4d225d927247383fecc0ff879dd35f1",
"icons/apple-icon-120x120.png": "97ce2212c9cbb750b30c7a97e7e3dae2",
"icons/android-icon-144x144.png": "57a923e265bab914c96dda17cf2b3179",
"icons/apple-icon-180x180.png": "7ffd4c595e541b42950cab20f53fe354",
"icons/android-icon-96x96.png": "cf1bdf5b1fc8d3018cba3c8450007d01",
"icons/favicon-32x32.png": "930661952fae8cc0b1c3148261820578",
"icons/ms-icon-310x310.png": "9fd3e9d3feb1ae6df42e1fbdf5cc1cbd",
"icons/favicon-16x16.png": "7bf130e6ab2255369ab4b75af0a5f402",
"icons/android-icon-192x192.png": "a0311f5f48f0276519c30546f0f264ad",
"icons/android-icon-36x36.png": "a9fd802a06a76b5fe6cb6b85e8beef9e",
"icons/ms-icon-150x150.png": "2291e51eed36fb39c54820eed92a3560"
};

// The application shell files that are downloaded before a service worker can
// start.
const CORE = [
  "main.dart.js",
"index.html",
"assets/AssetManifest.json",
"assets/FontManifest.json"];
// During install, the TEMP cache is populated with the application shell files.
self.addEventListener("install", (event) => {
  self.skipWaiting();
  return event.waitUntil(
    caches.open(TEMP).then((cache) => {
      return cache.addAll(
        CORE.map((value) => new Request(value, {'cache': 'reload'})));
    })
  );
});

// During activate, the cache is populated with the temp files downloaded in
// install. If this service worker is upgrading from one with a saved
// MANIFEST, then use this to retain unchanged resource files.
self.addEventListener("activate", function(event) {
  return event.waitUntil(async function() {
    try {
      var contentCache = await caches.open(CACHE_NAME);
      var tempCache = await caches.open(TEMP);
      var manifestCache = await caches.open(MANIFEST);
      var manifest = await manifestCache.match('manifest');
      // When there is no prior manifest, clear the entire cache.
      if (!manifest) {
        await caches.delete(CACHE_NAME);
        contentCache = await caches.open(CACHE_NAME);
        for (var request of await tempCache.keys()) {
          var response = await tempCache.match(request);
          await contentCache.put(request, response);
        }
        await caches.delete(TEMP);
        // Save the manifest to make future upgrades efficient.
        await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
        return;
      }
      var oldManifest = await manifest.json();
      var origin = self.location.origin;
      for (var request of await contentCache.keys()) {
        var key = request.url.substring(origin.length + 1);
        if (key == "") {
          key = "/";
        }
        // If a resource from the old manifest is not in the new cache, or if
        // the MD5 sum has changed, delete it. Otherwise the resource is left
        // in the cache and can be reused by the new service worker.
        if (!RESOURCES[key] || RESOURCES[key] != oldManifest[key]) {
          await contentCache.delete(request);
        }
      }
      // Populate the cache with the app shell TEMP files, potentially overwriting
      // cache files preserved above.
      for (var request of await tempCache.keys()) {
        var response = await tempCache.match(request);
        await contentCache.put(request, response);
      }
      await caches.delete(TEMP);
      // Save the manifest to make future upgrades efficient.
      await manifestCache.put('manifest', new Response(JSON.stringify(RESOURCES)));
      return;
    } catch (err) {
      // On an unhandled exception the state of the cache cannot be guaranteed.
      console.error('Failed to upgrade service worker: ' + err);
      await caches.delete(CACHE_NAME);
      await caches.delete(TEMP);
      await caches.delete(MANIFEST);
    }
  }());
});

// The fetch handler redirects requests for RESOURCE files to the service
// worker cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== 'GET') {
    return;
  }
  var origin = self.location.origin;
  var key = event.request.url.substring(origin.length + 1);
  // Redirect URLs to the index.html
  if (key.indexOf('?v=') != -1) {
    key = key.split('?v=')[0];
  }
  if (event.request.url == origin || event.request.url.startsWith(origin + '/#') || key == '') {
    key = '/';
  }
  // If the URL is not the RESOURCE list then return to signal that the
  // browser should take over.
  if (!RESOURCES[key]) {
    return;
  }
  // If the URL is the index.html, perform an online-first request.
  if (key == '/') {
    return onlineFirst(event);
  }
  event.respondWith(caches.open(CACHE_NAME)
    .then((cache) =>  {
      return cache.match(event.request).then((response) => {
        // Either respond with the cached resource, or perform a fetch and
        // lazily populate the cache only if the resource was successfully fetched.
        return response || fetch(event.request).then((response) => {
          if (response && Boolean(response.ok)) {
            cache.put(event.request, response.clone());
          }
          return response;
        });
      })
    })
  );
});

self.addEventListener('message', (event) => {
  // SkipWaiting can be used to immediately activate a waiting service worker.
  // This will also require a page refresh triggered by the main worker.
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
    return;
  }
  if (event.data === 'downloadOffline') {
    downloadOffline();
    return;
  }
});

// Download offline will check the RESOURCES for all files not in the cache
// and populate them.
async function downloadOffline() {
  var resources = [];
  var contentCache = await caches.open(CACHE_NAME);
  var currentContent = {};
  for (var request of await contentCache.keys()) {
    var key = request.url.substring(origin.length + 1);
    if (key == "") {
      key = "/";
    }
    currentContent[key] = true;
  }
  for (var resourceKey of Object.keys(RESOURCES)) {
    if (!currentContent[resourceKey]) {
      resources.push(resourceKey);
    }
  }
  return contentCache.addAll(resources);
}

// Attempt to download the resource online before falling back to
// the offline cache.
function onlineFirst(event) {
  return event.respondWith(
    fetch(event.request).then((response) => {
      return caches.open(CACHE_NAME).then((cache) => {
        cache.put(event.request, response.clone());
        return response;
      });
    }).catch((error) => {
      return caches.open(CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response != null) {
            return response;
          }
          throw error;
        });
      });
    })
  );
}
