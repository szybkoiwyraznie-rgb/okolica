#!/usr/bin/env python3
"""Serwer podglądu deweloperskiego: statyczne pliki BEZ cache'u.

Zwykły `http.server` pozwala przeglądarce cachować index.html, więc podgląd
potrafi pokazywać starą wersję mimo świeżego kodu. Ten serwer dokleja
`Cache-Control: no-store` do każdej odpowiedzi.

Użycie:  python3 tools/serwer-podgladu.py [port, domyślnie 8001]
Katalog: korzeń repo (serwuje index.html + app/ + test/).
"""
import functools
import http.server
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001


class BezCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

    def log_message(self, format, *args):  # cicho, jak http.server bez -v
        sys.stderr.write('%s - %s\n' % (self.address_string(), format % args))


if __name__ == '__main__':
    with http.server.ThreadingHTTPServer(('0.0.0.0', PORT), BezCache) as httpd:
        print(f'podgląd bez cache na http://0.0.0.0:{PORT} (korzeń repo)', flush=True)
        httpd.serve_forever()
